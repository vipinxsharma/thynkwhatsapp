import { neon } from "@neondatabase/serverless";
import { statusesThatCanEnter, type CheckoutStatus } from "@/lib/checkout/state";
import type { CheckoutOrderRecord, CheckoutStore } from "@/lib/checkout/service";

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

const ORDER_SELECT = `
  SELECT o.id, o.workspace_id AS "workspaceId", o.contact_id AS "contactId",
    o.conversation_id AS "conversationId", o.description, o.amount_paise AS "amountPaise",
    o.status, o.cashfree_link_id AS "cashfreeLinkId", o.payment_link_url AS "paymentLinkUrl",
    o.link_expires_at AS "linkExpiresAt", c.name AS "customerName", c.phone_number AS "customerPhone"
  FROM app_checkout_orders o
  JOIN app_inbox_contacts c ON c.id = o.contact_id AND c.workspace_id = o.workspace_id`;

type OrderRow = Omit<CheckoutOrderRecord, "status" | "linkExpiresAt"> & {
  status: string;
  linkExpiresAt: string | Date | null;
};

function toRecord(row: OrderRow): CheckoutOrderRecord {
  return {
    ...row,
    status: row.status as CheckoutStatus,
    linkExpiresAt: row.linkExpiresAt ? new Date(row.linkExpiresAt) : null,
  };
}

/** Postgres-backed store. Every status change is a guarded UPDATE, so concurrent webhooks cannot regress an order. */
export function createNeonCheckoutStore(): CheckoutStore {
  return {
    async findOrderByLinkId(linkId) {
      const rows = (await database().query(`${ORDER_SELECT} WHERE o.cashfree_link_id = $1`, [linkId])) as OrderRow[];
      return rows[0] ? toRecord(rows[0]) : null;
    },

    async findOrder(workspaceId, orderId) {
      const rows = (await database().query(
        `${ORDER_SELECT} WHERE o.workspace_id = $1::uuid AND o.id = $2::uuid`,
        [workspaceId, orderId]
      )) as OrderRow[];
      return rows[0] ? toRecord(rows[0]) : null;
    },

    async findConversationContact(workspaceId, conversationId) {
      const rows = (await database().query(
        `SELECT ct.id AS "contactId", ct.name, ct.phone_number AS "phoneNumber"
         FROM app_inbox_conversations cv
         JOIN app_inbox_contacts ct ON ct.id = cv.contact_id AND ct.workspace_id = cv.workspace_id
         WHERE cv.workspace_id = $1::uuid AND cv.id = $2::uuid`,
        [workspaceId, conversationId]
      )) as Array<{ contactId: string; name: string; phoneNumber: string }>;
      return rows[0] ?? null;
    },

    async insertOrder(order) {
      await database().query(
        `INSERT INTO app_checkout_orders
           (id, workspace_id, contact_id, conversation_id, description, amount_paise, created_by_auth_user_id)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7)`,
        [order.id, order.workspaceId, order.contactId, order.conversationId, order.description, order.amountPaise, order.actorUserId]
      );
    },

    async attachPaymentLink({ workspaceId, orderId, linkId, linkUrl, expiresAt, now }) {
      const rows = await database().query(
        `UPDATE app_checkout_orders
         SET status = 'link_sent', cashfree_link_id = $3, payment_link_url = $4, link_expires_at = $5,
             link_sent_at = $6, updated_at = now()
         WHERE workspace_id = $1::uuid AND id = $2::uuid
           AND (status IN ('created', 'failed', 'expired') OR (status = 'link_sent' AND link_expires_at <= $6))
         RETURNING id`,
        [workspaceId, orderId, linkId, linkUrl, expiresAt.toISOString(), now.toISOString()]
      );
      return rows.length > 0;
    },

    async markPaid({ workspaceId, orderId, paidAmountPaise, paymentRef, now }) {
      const rows = await database().query(
        `UPDATE app_checkout_orders
         SET status = 'paid', paid_at = $5, paid_amount_paise = $4, provider_payment_ref = $6, updated_at = now()
         WHERE workspace_id = $1::uuid AND id = $2::uuid
           AND status = ANY($3::text[]) AND amount_paise = $4
         RETURNING id`,
        [workspaceId, orderId, statusesThatCanEnter("paid"), paidAmountPaise, now.toISOString(), paymentRef]
      );
      return rows.length > 0;
    },

    async markFailedOrExpired({ workspaceId, orderId, to, now }) {
      const rows = await database().query(
        `UPDATE app_checkout_orders
         SET status = $3,
             failed_at = CASE WHEN $3 = 'failed' THEN $4::timestamptz ELSE failed_at END,
             expired_at = CASE WHEN $3 = 'expired' THEN $4::timestamptz ELSE expired_at END,
             updated_at = now()
         WHERE workspace_id = $1::uuid AND id = $2::uuid AND status = ANY($5::text[])
         RETURNING id`,
        [workspaceId, orderId, to, now.toISOString(), statusesThatCanEnter(to)]
      );
      return rows.length > 0;
    },

    async recordEvent(event) {
      const rows = await database().query(
        `INSERT INTO app_checkout_payment_events
           (id, workspace_id, order_id, provider_event_key, event_type, provider_status, provider_payment_ref,
            verified, outcome, raw_payload)
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9::jsonb)
         ON CONFLICT (provider_event_key) DO NOTHING
         RETURNING id`,
        [
          event.workspaceId, event.orderId, event.eventKey, event.eventType, event.providerStatus,
          event.paymentRef, event.confirmed, event.outcome, JSON.stringify(event.payload),
        ]
      );
      return rows.length > 0;
    },
  };
}

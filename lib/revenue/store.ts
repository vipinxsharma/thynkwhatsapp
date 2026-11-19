import { neon } from "@neondatabase/serverless";
import type {
  AttributionRecord,
  ConversationRecord,
  OrderRecord,
  OrderStatus,
  PaymentEventRecord,
  ReconciliationInput,
} from "@/lib/revenue/reconcile";

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

/**
 * Loads the rows the reconciliation needs for one workspace. Read-only.
 * Depends on app_ad_attributions (0030), app_checkout_orders and app_checkout_payment_events (0029).
 * No ad spend table exists yet, so spend is left unset and the report says it is not synced.
 */
export async function loadRevenueInputs(workspaceId: string): Promise<ReconciliationInput> {
  const db = database();

  const attributionRows = (await db.query(
    `SELECT contact_id AS "contactId", wam_id AS "wamId", source_type AS "sourceType", source_id AS "sourceId",
       headline, referred_at AS "referredAt"
     FROM app_ad_attributions
     WHERE workspace_id = $1::uuid`,
    [workspaceId],
  )) as Array<Omit<AttributionRecord, "referredAt"> & { referredAt: string | Date }>;

  const conversationRows = (await db.query(
    `SELECT id AS "conversationId", contact_id AS "contactId"
     FROM app_inbox_conversations
     WHERE workspace_id = $1::uuid`,
    [workspaceId],
  )) as ConversationRecord[];

  const orderRows = (await db.query(
    `SELECT id AS "orderId", contact_id AS "contactId", conversation_id AS "conversationId",
       amount_paise AS "amountPaise", status, created_at AS "createdAt", paid_amount_paise AS "paidAmountPaise"
     FROM app_checkout_orders
     WHERE workspace_id = $1::uuid`,
    [workspaceId],
  )) as Array<Omit<OrderRecord, "status" | "createdAt" | "amountPaise" | "paidAmountPaise"> & {
    status: string;
    createdAt: string | Date;
    amountPaise: number | string;
    paidAmountPaise: number | string | null;
  }>;

  const eventRows = (await db.query(
    `SELECT order_id AS "orderId", verified, outcome, received_at AS "receivedAt"
     FROM app_checkout_payment_events
     WHERE workspace_id = $1::uuid`,
    [workspaceId],
  )) as Array<Omit<PaymentEventRecord, "receivedAt"> & { receivedAt: string | Date }>;

  return {
    attributions: attributionRows.map((row) => ({ ...row, referredAt: new Date(row.referredAt) })),
    conversations: conversationRows,
    orders: orderRows.map((row) => ({
      orderId: row.orderId,
      contactId: row.contactId,
      conversationId: row.conversationId,
      amountPaise: Number(row.amountPaise),
      status: row.status as OrderStatus,
      createdAt: new Date(row.createdAt),
      paidAmountPaise: row.paidAmountPaise === null ? null : Number(row.paidAmountPaise),
    })),
    paymentEvents: eventRows.map((row) => ({ ...row, receivedAt: new Date(row.receivedAt) })),
  };
}

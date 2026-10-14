import { createHash, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { Message } from "@/types/strapi";
import type { MetaSendMessagePayload } from "@/types/meta-api";

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

export type OutboundStatus = "sending" | "accepted" | "rejected" | "uncertain";

export interface OutboundRequest {
  id: string;
  status: OutboundStatus;
  requestHash: string;
  wamId: string | null;
  createdNew: boolean;
}

export function hashOutboundRequest(input: {
  conversationId: string;
  phoneNumberId: string;
  recipientWaId: string;
  payload: MetaSendMessagePayload;
}): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function beginOutboundRequest(input: {
  workspaceId: string;
  conversationId: string;
  idempotencyKey: string;
  requestHash: string;
  authUserId: string;
  phoneNumberId: string;
  recipientWaId: string;
  messageType: string;
  messageBody: string;
  payload: MetaSendMessagePayload;
}): Promise<OutboundRequest> {
  const db = database();
  const inserted = await db.query(
    `INSERT INTO app_outbound_requests
       (id, workspace_id, conversation_id, idempotency_key, request_hash,
        requested_by_auth_user_id, phone_number_id, recipient_wa_id,
        message_type, message_body, payload)
     SELECT $1::uuid, $2::uuid, c.id, $4::uuid, $5, $6, $7, $8, $9, $10, $11::jsonb
     FROM app_inbox_conversations c
     WHERE c.workspace_id = $2::uuid AND c.id = $3::uuid
     ON CONFLICT (workspace_id, idempotency_key) DO NOTHING
     RETURNING id, status, request_hash AS "requestHash", wam_id AS "wamId"`,
    [randomUUID(), input.workspaceId, input.conversationId, input.idempotencyKey,
      input.requestHash, input.authUserId, input.phoneNumberId,
      input.recipientWaId, input.messageType, input.messageBody, JSON.stringify(input.payload)]
  );
  if (inserted[0]) return { ...(inserted[0] as Omit<OutboundRequest, "createdNew">), createdNew: true };

  const existing = await db.query(
    `SELECT id, status, request_hash AS "requestHash", wam_id AS "wamId"
     FROM app_outbound_requests WHERE workspace_id = $1::uuid AND idempotency_key = $2::uuid LIMIT 1`,
    [input.workspaceId, input.idempotencyKey]
  );
  if (!existing[0]) throw new Error("Conversation not found or outbound request could not be reserved");
  return { ...(existing[0] as Omit<OutboundRequest, "createdNew">), createdNew: false };
}

export async function getAcceptedMessage(workspaceId: string, wamId: string): Promise<Message | null> {
  const rows = await database().query(
    `SELECT id, wam_id AS "wamId", direction, type, body, raw_payload AS "rawPayload",
      status, timestamp, conversation_id AS "conversationId"
     FROM app_inbox_messages WHERE workspace_id = $1::uuid AND wam_id = $2 LIMIT 1`,
    [workspaceId, wamId]
  );
  return (rows[0] as Message | undefined) || null;
}

export async function acceptOutboundRequest(input: {
  workspaceId: string;
  requestId: string;
  wamId: string;
}): Promise<Message> {
  const rows = await database().query(
    `WITH accepted AS (
       UPDATE app_outbound_requests SET status = 'accepted', wam_id = $3,
         completed_at = now(), updated_at = now()
       WHERE workspace_id = $1::uuid AND id = $2::uuid AND status = 'sending'
       RETURNING conversation_id, message_type, message_body, payload
     ), inserted AS (
       INSERT INTO app_inbox_messages
         (id, workspace_id, conversation_id, wam_id, direction, type, body, raw_payload, status, timestamp)
       SELECT $4::uuid, $1::uuid, conversation_id, $3, 'outbound',
         message_type, message_body, payload, 'sent', now() FROM accepted
       ON CONFLICT (workspace_id, wam_id) DO NOTHING
       RETURNING *
     ), advanced AS (
       UPDATE app_inbox_conversations c SET last_message_at = now(), updated_at = now()
       WHERE c.workspace_id = $1::uuid AND c.id IN (SELECT conversation_id FROM inserted)
       RETURNING c.id
     )
     SELECT id, wam_id AS "wamId", direction, type, body, raw_payload AS "rawPayload",
       status, timestamp, conversation_id AS "conversationId" FROM inserted`,
    [input.workspaceId, input.requestId, input.wamId, randomUUID()]
  );
  if (!rows[0]) throw new Error("Meta accepted the send, but the local message could not be confirmed");
  return rows[0] as Message;
}

export async function markOutboundUncertain(workspaceId: string, requestId: string): Promise<void> {
  await database().query(
    `UPDATE app_outbound_requests SET status = 'uncertain', updated_at = now()
     WHERE workspace_id = $1::uuid AND id = $2::uuid AND status = 'sending'`,
    [workspaceId, requestId]
  );
}

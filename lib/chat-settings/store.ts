import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { emptyChatSettings, type ChatSettings } from "./handling";

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

export async function getChatSettings(workspaceId: string): Promise<ChatSettings> {
  const rows = await database().query(
    `SELECT unsubscribe_keyword AS "unsubscribeKeyword", handover_keyword AS "handoverKeyword",
       handover_message AS "handoverMessage", holding_message AS "holdingMessage"
     FROM app_workspace_chat_settings WHERE workspace_id = $1::uuid`,
    [workspaceId],
  ) as ChatSettings[];
  return rows[0] ? { ...emptyChatSettings, ...rows[0] } : emptyChatSettings;
}

export async function saveChatSettings(workspaceId: string, userId: string, settings: ChatSettings): Promise<ChatSettings> {
  const rows = await database().query(
    `INSERT INTO app_workspace_chat_settings
       (workspace_id, unsubscribe_keyword, handover_keyword, handover_message, holding_message, updated_by_auth_user_id, updated_at)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, now())
     ON CONFLICT (workspace_id) DO UPDATE SET
       unsubscribe_keyword = EXCLUDED.unsubscribe_keyword,
       handover_keyword = EXCLUDED.handover_keyword,
       handover_message = EXCLUDED.handover_message,
       holding_message = EXCLUDED.holding_message,
       updated_by_auth_user_id = EXCLUDED.updated_by_auth_user_id,
       updated_at = now()
     RETURNING unsubscribe_keyword AS "unsubscribeKeyword", handover_keyword AS "handoverKeyword",
       handover_message AS "handoverMessage", holding_message AS "holdingMessage"`,
    [workspaceId, settings.unsubscribeKeyword, settings.handoverKeyword, settings.handoverMessage, settings.holdingMessage, userId],
  ) as ChatSettings[];
  return rows[0];
}

export interface BlockedNumber { waId: string; createdAt: string }

export async function listBlockedNumbers(workspaceId: string): Promise<BlockedNumber[]> {
  return await database().query(
    `SELECT wa_id AS "waId", created_at AS "createdAt" FROM app_blocked_phone_numbers
     WHERE workspace_id = $1::uuid ORDER BY created_at DESC LIMIT 500`,
    [workspaceId],
  ) as BlockedNumber[];
}

export async function blockNumber(workspaceId: string, userId: string, waId: string): Promise<void> {
  await database().query(
    `INSERT INTO app_blocked_phone_numbers (workspace_id, wa_id, blocked_by_auth_user_id)
     VALUES ($1::uuid, $2, $3) ON CONFLICT (workspace_id, wa_id) DO NOTHING`,
    [workspaceId, waId, userId],
  );
}

export async function unblockNumber(workspaceId: string, waId: string): Promise<boolean> {
  const rows = await database().query(
    `DELETE FROM app_blocked_phone_numbers WHERE workspace_id = $1::uuid AND wa_id = $2 RETURNING wa_id`,
    [workspaceId, waId],
  );
  return rows.length > 0;
}

/**
 * Marks the contact opted out of marketing messages. Uses the same consent table as campaigns
 * (app_contact_marketing_consent) so a stop request applies everywhere.
 */
export async function recordInboundOptOut(workspaceId: string, waId: string): Promise<boolean> {
  const rows = await database().query(
    `INSERT INTO app_contact_marketing_consent (workspace_id, contact_id, status, source)
     SELECT c.workspace_id, c.id, 'opted_out', 'inbound_keyword' FROM app_inbox_contacts c
     WHERE c.workspace_id = $1::uuid AND c.wa_id = $2
     ON CONFLICT (workspace_id, contact_id) DO UPDATE SET
       status = 'opted_out', source = 'inbound_keyword', recorded_by_auth_user_id = NULL, updated_at = now()
     RETURNING contact_id`,
    [workspaceId, waId],
  );
  return rows.length > 0;
}

/** Moves the conversation to pending so an agent takes over. Bot replies stop while it is pending. */
export async function handOverConversation(workspaceId: string, conversationId: string): Promise<boolean> {
  const rows = await database().query(
    `WITH updated AS (
       UPDATE app_inbox_conversations SET status = 'pending', updated_at = now()
       WHERE workspace_id = $1::uuid AND id = $2::uuid AND status <> 'pending'
       RETURNING id
     ), audit AS (
       INSERT INTO app_audit_logs (id, workspace_id, auth_user_id, action, resource_type, resource_id, metadata)
       SELECT $3::uuid, $1::uuid, 'automation', 'conversation.handover', 'conversation', id::text,
         '{"source":"keyword"}'::jsonb FROM updated
     )
     SELECT id FROM updated`,
    [workspaceId, conversationId, randomUUID()],
  );
  return rows.length > 0;
}

/** Atomically claims the holding message for a conversation: at most one every 12 hours. */
export async function claimHoldingMessage(workspaceId: string, conversationId: string): Promise<boolean> {
  const rows = await database().query(
    `UPDATE app_inbox_conversations SET holding_message_sent_at = now(), updated_at = now()
     WHERE workspace_id = $1::uuid AND id = $2::uuid
       AND (holding_message_sent_at IS NULL OR holding_message_sent_at < now() - interval '12 hours')
     RETURNING id`,
    [workspaceId, conversationId],
  );
  return rows.length > 0;
}

/**
 * Two flags for one sender, read in one query. `blocked`: the number is blocked. `stopped`: the
 * contact asked to stop with the unsubscribe keyword, so they get no automated messages.
 * Manual opt-outs from campaign consent do not stop bot replies to messages they send.
 */
export async function getSenderFlags(workspaceId: string, waId: string): Promise<{ blocked: boolean; stopped: boolean }> {
  const rows = await database().query(
    `SELECT
       EXISTS (SELECT 1 FROM app_blocked_phone_numbers b WHERE b.workspace_id = $1::uuid AND b.wa_id = $2) AS blocked,
       EXISTS (SELECT 1 FROM app_contact_marketing_consent m
         JOIN app_inbox_contacts c ON c.workspace_id = m.workspace_id AND c.id = m.contact_id
         WHERE m.workspace_id = $1::uuid AND c.wa_id = $2 AND m.status = 'opted_out' AND m.source = 'inbound_keyword') AS stopped`,
    [workspaceId, waId],
  ) as Array<{ blocked: boolean; stopped: boolean }>;
  return { blocked: Boolean(rows[0]?.blocked), stopped: Boolean(rows[0]?.stopped) };
}

import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

export type SupportStatus = "received" | "triaged" | "awaiting_customer" | "auto_resolved" | "escalated" | "closed";
export type SupportChannel = "chat" | "email";
export type SupportSender = "customer" | "ai" | "human" | "system";

export interface SupportCase {
  id: string;
  workspaceId: string;
  requesterEmail: string;
  subject: string;
  status: SupportStatus;
  priority: "low" | "normal" | "high" | "urgent";
  sourceChannel: SupportChannel;
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessage {
  id: string;
  caseId: string;
  channel: SupportChannel;
  senderType: SupportSender;
  body: string;
  createdAt: string;
}

function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

export function extractWorkspaceSlug(recipient: string): string | null {
  const match = recipient.toLowerCase().match(/^support\+([a-z0-9-]+)@[^@]+$/);
  return match?.[1] || null;
}

export async function listSupportCases(workspaceId: string): Promise<SupportCase[]> {
  return (await sql().query(
    `SELECT id, workspace_id AS "workspaceId", requester_email AS "requesterEmail",
      subject, status, priority, source_channel AS "sourceChannel",
      created_at AS "createdAt", updated_at AS "updatedAt"
     FROM app_support_cases WHERE workspace_id = $1::uuid ORDER BY updated_at DESC LIMIT 100`,
    [workspaceId]
  )) as SupportCase[];
}

export async function createSupportCase(input: {
  workspaceId: string;
  authUserId?: string;
  requesterEmail: string;
  subject: string;
  body: string;
  channel: SupportChannel;
  externalMessageId?: string;
}): Promise<SupportCase> {
  const caseId = crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const rows = await sql().query(
    `WITH created_case AS (
       INSERT INTO app_support_cases
         (id, workspace_id, requester_auth_user_id, requester_email, subject, source_channel, external_source_id)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $9)
       ON CONFLICT (workspace_id, external_source_id) DO NOTHING
       RETURNING id, workspace_id, requester_email, subject, status, priority, source_channel, created_at, updated_at
     ), selected_case AS (
       SELECT * FROM created_case
       UNION ALL
       SELECT id, workspace_id, requester_email, subject, status, priority, source_channel, created_at, updated_at
       FROM app_support_cases
       WHERE workspace_id = $2::uuid AND external_source_id = $9
       LIMIT 1
     ), created_message AS (
       INSERT INTO app_support_messages
         (id, case_id, workspace_id, channel, sender_type, body, external_message_id)
       SELECT $7::uuid, id, workspace_id, $6, 'customer', $8, $9 FROM created_case
     )
     SELECT id, workspace_id AS "workspaceId", requester_email AS "requesterEmail",
       subject, status, priority, source_channel AS "sourceChannel",
       created_at AS "createdAt", updated_at AS "updatedAt" FROM selected_case`,
    [caseId, input.workspaceId, input.authUserId || null, input.requesterEmail, input.subject, input.channel, messageId, input.body, input.externalMessageId || null]
  );
  return rows[0] as SupportCase;
}

export async function createSupportCaseFromEmail(input: {
  workspaceSlug: string;
  requesterEmail: string;
  subject: string;
  body: string;
  externalMessageId: string;
}): Promise<SupportCase | null> {
  const workspaces = await sql().query("SELECT id FROM app_workspaces WHERE slug = $1 LIMIT 1", [input.workspaceSlug]);
  const workspace = workspaces[0] as { id: string } | undefined;
  if (!workspace) return null;
  return createSupportCase({ workspaceId: workspace.id, requesterEmail: input.requesterEmail, subject: input.subject, body: input.body, channel: "email", externalMessageId: input.externalMessageId });
}

export async function listSupportMessages(workspaceId: string, caseId: string): Promise<SupportMessage[]> {
  return (await sql().query(
    `SELECT id, case_id AS "caseId", channel, sender_type AS "senderType", body, created_at AS "createdAt"
     FROM app_support_messages WHERE workspace_id = $1::uuid AND case_id = $2::uuid ORDER BY created_at ASC`,
    [workspaceId, caseId]
  )) as SupportMessage[];
}

export async function addSupportMessage(input: {
  workspaceId: string;
  caseId: string;
  senderType: SupportSender;
  channel: SupportChannel;
  body: string;
}): Promise<SupportMessage | null> {
  const rows = await sql().query(
    `WITH existing_case AS (
       SELECT id, requester_email, subject FROM app_support_cases
       WHERE id = $1::uuid AND workspace_id = $2::uuid
     ), created_message AS (
       INSERT INTO app_support_messages (id, case_id, workspace_id, channel, sender_type, body)
       SELECT $3::uuid, id, $2::uuid, $4, $5, $6 FROM existing_case
       RETURNING id, case_id, channel, sender_type, body, created_at
     ), queued_email AS (
       INSERT INTO app_support_email_outbox (id, workspace_id, case_id, recipient_email, subject, body)
       SELECT $7::uuid, $2::uuid, id, requester_email, 'Re: ' || subject, $6 FROM existing_case
       WHERE $4 = 'email' AND $5 IN ('ai', 'human')
     ), touched AS (
       UPDATE app_support_cases SET updated_at = now(),
         status = CASE WHEN $5 = 'customer' THEN 'received' ELSE status END
       WHERE id IN (SELECT id FROM existing_case)
     )
     SELECT id, case_id AS "caseId", channel, sender_type AS "senderType", body, created_at AS "createdAt"
     FROM created_message`,
    [input.caseId, input.workspaceId, crypto.randomUUID(), input.channel, input.senderType, input.body, crypto.randomUUID()]
  );
  return (rows[0] as SupportMessage | undefined) || null;
}

import { neon } from "@neondatabase/serverless";

export type CampaignStatus = "draft" | "sending" | "paused" | "completed" | "cancelled";
export type RecipientStatus =
  | "pending" | "sending" | "sent" | "delivered" | "read" | "failed" | "uncertain" | "skipped";
export type ConsentStatus = "opted_in" | "opted_out";

export const MAX_CAMPAIGN_RECIPIENTS = 10000;
// A recipient claimed this long ago without a recorded outcome is treated as uncertain.
const STUCK_AFTER_MINUTES = 15;

export interface CampaignCounts {
  total: number;
  pending: number;
  sending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  uncertain: number;
  skipped: number;
}

export interface Campaign {
  id: string;
  workspaceId: string;
  name: string;
  phoneNumberId: string;
  wabaId: string;
  templateName: string;
  templateLanguage: string;
  templateVariables: string[];
  audienceTag: string | null;
  status: CampaignStatus;
  lastError: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  counts: CampaignCounts;
}

export interface ConsentContact {
  id: string;
  name: string;
  phoneNumber: string;
  tags: string[];
  consent: ConsentStatus | null;
}

export interface ClaimedRecipient {
  id: string;
  contactId: string;
  waId: string;
  contactName: string;
}

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

const iso = (value: unknown): string | null => (value ? new Date(value as string).toISOString() : null);

const campaignSelect = `
  SELECT c.id, c.workspace_id AS "workspaceId", c.name, c.phone_number_id AS "phoneNumberId",
    c.waba_id AS "wabaId", c.template_name AS "templateName", c.template_language AS "templateLanguage",
    c.template_variables AS "templateVariables", c.audience_tag AS "audienceTag", c.status,
    c.last_error AS "lastError", c.created_at AS "createdAt", c.started_at AS "startedAt",
    c.completed_at AS "completedAt",
    count(r.id)::int AS total,
    count(r.id) FILTER (WHERE r.status = 'pending')::int AS pending,
    count(r.id) FILTER (WHERE r.status = 'sending')::int AS sending,
    count(r.id) FILTER (WHERE r.status = 'sent')::int AS sent,
    count(r.id) FILTER (WHERE r.status = 'delivered')::int AS delivered,
    count(r.id) FILTER (WHERE r.status = 'read')::int AS read,
    count(r.id) FILTER (WHERE r.status = 'failed')::int AS failed,
    count(r.id) FILTER (WHERE r.status = 'uncertain')::int AS uncertain,
    count(r.id) FILTER (WHERE r.status = 'skipped')::int AS skipped
  FROM app_campaigns c
  LEFT JOIN app_campaign_recipients r ON r.campaign_id = c.id`;

function campaignFromRow(row: Record<string, unknown>): Campaign {
  return {
    id: String(row.id),
    workspaceId: String(row.workspaceId),
    name: String(row.name),
    phoneNumberId: String(row.phoneNumberId),
    wabaId: String(row.wabaId),
    templateName: String(row.templateName),
    templateLanguage: String(row.templateLanguage),
    templateVariables: Array.isArray(row.templateVariables) ? row.templateVariables.map(String) : [],
    audienceTag: row.audienceTag ? String(row.audienceTag) : null,
    status: row.status as CampaignStatus,
    lastError: row.lastError ? String(row.lastError) : null,
    createdAt: iso(row.createdAt) || "",
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    counts: {
      total: Number(row.total), pending: Number(row.pending), sending: Number(row.sending),
      sent: Number(row.sent), delivered: Number(row.delivered), read: Number(row.read),
      failed: Number(row.failed), uncertain: Number(row.uncertain), skipped: Number(row.skipped),
    },
  };
}

// ---------------------------------------------------------------- consent

export async function listConsentContacts(workspaceId: string): Promise<ConsentContact[]> {
  const rows = await database().query(
    `SELECT c.id, c.name, c.phone_number AS "phoneNumber", c.tags, m.status AS consent
     FROM app_inbox_contacts c
     LEFT JOIN app_contact_marketing_consent m ON m.workspace_id = c.workspace_id AND m.contact_id = c.id
     WHERE c.workspace_id = $1::uuid
     ORDER BY lower(c.name), c.id LIMIT 5000`,
    [workspaceId]
  );
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    phoneNumber: String(row.phoneNumber),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    consent: (row.consent as ConsentStatus | null) ?? null,
  }));
}

/** Records consent for contacts of this workspace only; ids from other workspaces are ignored. */
export async function setMarketingConsent(input: {
  workspaceId: string;
  contactIds: string[];
  status: ConsentStatus;
  authUserId: string;
}): Promise<number> {
  if (input.contactIds.length === 0) return 0;
  const db = database();
  const rows = await db.query(
    `INSERT INTO app_contact_marketing_consent
       (workspace_id, contact_id, status, source, recorded_by_auth_user_id)
     SELECT c.workspace_id, c.id, $3, 'manual', $4 FROM app_inbox_contacts c
     WHERE c.workspace_id = $1::uuid AND c.id = ANY($2::uuid[])
     ON CONFLICT (workspace_id, contact_id) DO UPDATE SET
       status = EXCLUDED.status, source = 'manual',
       recorded_by_auth_user_id = EXCLUDED.recorded_by_auth_user_id, updated_at = now()
     RETURNING contact_id`,
    [input.workspaceId, input.contactIds, input.status, input.authUserId]
  );
  if (input.status === "opted_out" && rows.length > 0) {
    await db.query(
      `UPDATE app_campaign_recipients SET status = 'skipped', error = 'Contact opted out', updated_at = now()
       WHERE workspace_id = $1::uuid AND contact_id = ANY($2::uuid[]) AND status = 'pending'`,
      [input.workspaceId, rows.map((row) => String(row.contact_id))]
    );
  }
  return rows.length;
}

/** A contact asked to stop: opt them out and drop them from any campaign not yet sent to them. */
export async function recordOptOutByWaId(workspaceId: string, waId: string): Promise<boolean> {
  const db = database();
  const rows = await db.query(
    `INSERT INTO app_contact_marketing_consent (workspace_id, contact_id, status, source)
     SELECT c.workspace_id, c.id, 'opted_out', 'inbound_keyword' FROM app_inbox_contacts c
     WHERE c.workspace_id = $1::uuid AND c.wa_id = $2
     ON CONFLICT (workspace_id, contact_id) DO UPDATE SET
       status = 'opted_out', source = 'inbound_keyword', recorded_by_auth_user_id = NULL, updated_at = now()
     RETURNING contact_id`,
    [workspaceId, waId]
  );
  const contactId = (rows[0] as { contact_id?: string } | undefined)?.contact_id;
  if (!contactId) return false;
  await db.query(
    `UPDATE app_campaign_recipients SET status = 'skipped', error = 'Contact opted out', updated_at = now()
     WHERE workspace_id = $1::uuid AND contact_id = $2::uuid AND status = 'pending'`,
    [workspaceId, contactId]
  );
  return true;
}

export async function countAudience(workspaceId: string, tag: string | null): Promise<{ contacts: number; optedIn: number }> {
  const rows = await database().query(
    `SELECT count(*)::int AS contacts,
       count(*) FILTER (WHERE m.status = 'opted_in')::int AS "optedIn"
     FROM app_inbox_contacts c
     LEFT JOIN app_contact_marketing_consent m ON m.workspace_id = c.workspace_id AND m.contact_id = c.id
     WHERE c.workspace_id = $1::uuid AND ($2::text IS NULL OR c.tags ? $2::text)`,
    [workspaceId, tag]
  );
  const row = rows[0] as { contacts: number; optedIn: number };
  return { contacts: Number(row.contacts), optedIn: Number(row.optedIn) };
}

// --------------------------------------------------------------- campaigns

/**
 * Creates the campaign and snapshots its recipients (opted-in contacts, optionally one tag)
 * in a single statement. Re-posting the same id returns the existing campaign unchanged.
 */
export async function createCampaign(input: {
  id: string;
  workspaceId: string;
  name: string;
  phoneNumberId: string;
  wabaId: string;
  templateName: string;
  templateLanguage: string;
  templateVariables: string[];
  audienceTag: string | null;
  authUserId: string;
}): Promise<Campaign | null> {
  await database().query(
    `WITH created AS (
       INSERT INTO app_campaigns
         (id, workspace_id, name, phone_number_id, waba_id, template_name, template_language,
          template_variables, audience_tag, created_by_auth_user_id)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
       ON CONFLICT (id) DO NOTHING
       RETURNING id, workspace_id
     )
     INSERT INTO app_campaign_recipients (workspace_id, campaign_id, contact_id, wa_id, contact_name)
     SELECT created.workspace_id, created.id, c.id, c.wa_id, c.name
     FROM created
     JOIN app_inbox_contacts c ON c.workspace_id = created.workspace_id
     JOIN app_contact_marketing_consent m
       ON m.workspace_id = c.workspace_id AND m.contact_id = c.id AND m.status = 'opted_in'
     WHERE ($9::text IS NULL OR c.tags ? $9::text)
     ORDER BY c.id LIMIT $11`,
    [input.id, input.workspaceId, input.name, input.phoneNumberId, input.wabaId, input.templateName,
      input.templateLanguage, JSON.stringify(input.templateVariables), input.audienceTag, input.authUserId,
      MAX_CAMPAIGN_RECIPIENTS]
  );
  const campaign = await getCampaign(input.workspaceId, input.id);
  if (campaign) {
    await database().query(
      `UPDATE app_campaigns SET total_recipients = $3 WHERE workspace_id = $1::uuid AND id = $2::uuid`,
      [input.workspaceId, input.id, campaign.counts.total]
    );
  }
  return campaign;
}

export async function listCampaigns(workspaceId: string): Promise<Campaign[]> {
  const rows = await database().query(
    `${campaignSelect} WHERE c.workspace_id = $1::uuid GROUP BY c.id ORDER BY c.created_at DESC LIMIT 100`,
    [workspaceId]
  );
  return rows.map(campaignFromRow);
}

export async function getCampaign(workspaceId: string, campaignId: string): Promise<Campaign | null> {
  const rows = await database().query(
    `${campaignSelect} WHERE c.workspace_id = $1::uuid AND c.id = $2::uuid GROUP BY c.id`,
    [workspaceId, campaignId]
  );
  return rows[0] ? campaignFromRow(rows[0]) : null;
}

export interface RecipientProblem {
  contactName: string;
  waId: string;
  status: RecipientStatus;
  error: string | null;
}

export async function listRecipientProblems(workspaceId: string, campaignId: string): Promise<RecipientProblem[]> {
  const rows = await database().query(
    `SELECT contact_name AS "contactName", wa_id AS "waId", status, error
     FROM app_campaign_recipients
     WHERE workspace_id = $1::uuid AND campaign_id = $2::uuid AND status IN ('failed', 'uncertain', 'skipped')
     ORDER BY updated_at DESC LIMIT 50`,
    [workspaceId, campaignId]
  );
  return rows as RecipientProblem[];
}

/** Campaigns in `sending` across every workspace, oldest first, for the scheduled worker. */
export async function listSendingCampaigns(limit: number): Promise<Array<{ id: string; workspaceId: string }>> {
  const rows = await database().query(
    `SELECT id, workspace_id AS "workspaceId" FROM app_campaigns
     WHERE status = 'sending' ORDER BY started_at ASC NULLS FIRST LIMIT $1`,
    [limit]
  );
  return rows as Array<{ id: string; workspaceId: string }>;
}

export type CampaignAction = "start" | "pause" | "cancel";

const transitions: Record<CampaignAction, { from: CampaignStatus[]; to: CampaignStatus }> = {
  start: { from: ["draft", "paused"], to: "sending" },
  pause: { from: ["sending"], to: "paused" },
  cancel: { from: ["draft", "sending", "paused"], to: "cancelled" },
};

/** Moves a campaign between states. Returns false when the move is not allowed from its current state. */
export async function transitionCampaign(
  workspaceId: string, campaignId: string, action: CampaignAction, reason?: string
): Promise<boolean> {
  const { from, to } = transitions[action];
  const db = database();
  const rows = await db.query(
    `UPDATE app_campaigns SET status = $3,
       started_at = CASE WHEN $3 = 'sending' THEN coalesce(started_at, now()) ELSE started_at END,
       completed_at = CASE WHEN $3 = 'cancelled' THEN now() ELSE completed_at END,
       last_error = CASE WHEN $3 = 'sending' THEN NULL ELSE coalesce($5, last_error) END,
       updated_at = now()
     WHERE workspace_id = $1::uuid AND id = $2::uuid AND status = ANY($4::text[])
     RETURNING id`,
    [workspaceId, campaignId, to, from, reason ? reason.slice(0, 500) : null]
  );
  if (!rows[0]) return false;
  if (action === "cancel") {
    await db.query(
      `UPDATE app_campaign_recipients SET status = 'skipped', error = 'Campaign cancelled', updated_at = now()
       WHERE workspace_id = $1::uuid AND campaign_id = $2::uuid AND status = 'pending'`,
      [workspaceId, campaignId]
    );
  }
  return true;
}

// ------------------------------------------------------------ send worker

/** Marks recipients a worker claimed long ago, with no recorded outcome, as uncertain. Never retried. */
export async function expireStuckRecipients(workspaceId: string, campaignId: string): Promise<void> {
  await database().query(
    `UPDATE app_campaign_recipients SET status = 'uncertain',
       error = 'The send was interrupted before its outcome was recorded', updated_at = now()
     WHERE workspace_id = $1::uuid AND campaign_id = $2::uuid AND status = 'sending'
       AND attempted_at < now() - make_interval(mins => $3::int)`,
    [workspaceId, campaignId, STUCK_AFTER_MINUTES]
  );
}

/**
 * Atomically claims pending recipients of a campaign that is `sending`. Concurrent
 * workers get disjoint rows, so no recipient is ever claimed twice.
 */
export async function claimRecipients(workspaceId: string, campaignId: string, limit: number): Promise<ClaimedRecipient[]> {
  const rows = await database().query(
    `UPDATE app_campaign_recipients r SET status = 'sending', attempted_at = now(), updated_at = now()
     WHERE r.id IN (
       SELECT r2.id FROM app_campaign_recipients r2
       JOIN app_campaigns c ON c.id = r2.campaign_id AND c.status = 'sending'
       WHERE r2.workspace_id = $1::uuid AND r2.campaign_id = $2::uuid AND r2.status = 'pending'
       ORDER BY r2.id LIMIT $3
       FOR UPDATE OF r2 SKIP LOCKED
     )
     RETURNING r.id, r.contact_id AS "contactId", r.wa_id AS "waId", r.contact_name AS "contactName"`,
    [workspaceId, campaignId, limit]
  );
  return rows as ClaimedRecipient[];
}

export async function optedInContactIds(workspaceId: string, contactIds: string[]): Promise<Set<string>> {
  if (contactIds.length === 0) return new Set();
  const rows = await database().query(
    `SELECT contact_id AS "contactId" FROM app_contact_marketing_consent
     WHERE workspace_id = $1::uuid AND contact_id = ANY($2::uuid[]) AND status = 'opted_in'`,
    [workspaceId, contactIds]
  );
  return new Set(rows.map((row) => String(row.contactId)));
}

/** Records the outcome of a claimed recipient. Only a row still in `sending` is changed. */
export async function settleRecipient(input: {
  recipientId: string;
  status: "sent" | "failed" | "uncertain" | "skipped" | "pending";
  wamId?: string;
  error?: string;
}): Promise<void> {
  await database().query(
    `UPDATE app_campaign_recipients SET status = $2, wam_id = coalesce($3, wam_id),
       error = $4, attempted_at = CASE WHEN $2 = 'pending' THEN NULL ELSE attempted_at END, updated_at = now()
     WHERE id = $1::uuid AND status = 'sending'`,
    [input.recipientId, input.status, input.wamId ?? null, input.error ? input.error.slice(0, 500) : null]
  );
}

/** Completes a campaign once nothing is left to send. Returns true when it was completed now. */
export async function completeCampaignIfDone(workspaceId: string, campaignId: string): Promise<boolean> {
  const rows = await database().query(
    `UPDATE app_campaigns c SET status = 'completed', completed_at = now(), updated_at = now()
     WHERE c.workspace_id = $1::uuid AND c.id = $2::uuid AND c.status = 'sending'
       AND NOT EXISTS (
         SELECT 1 FROM app_campaign_recipients r
         WHERE r.campaign_id = c.id AND r.status IN ('pending', 'sending')
       )
     RETURNING c.id`,
    [workspaceId, campaignId]
  );
  return Boolean(rows[0]);
}

/** The inbox conversation for this contact on this sender number, if one exists. */
export async function findConversationId(workspaceId: string, contactId: string, phoneNumberId: string): Promise<string | null> {
  const rows = await database().query(
    `SELECT id FROM app_inbox_conversations
     WHERE workspace_id = $1::uuid AND contact_id = $2::uuid AND phone_number_id = $3 LIMIT 1`,
    [workspaceId, contactId, phoneNumberId]
  );
  return rows[0] ? String((rows[0] as { id: string }).id) : null;
}

/**
 * Applies a delivery receipt from Meta to a campaign recipient. Status only moves
 * forward (sent → delivered → read); `failed` applies only before delivery.
 */
export async function applyDeliveryReceipt(
  workspaceId: string, wamId: string, status: string, error?: string
): Promise<void> {
  if (!["sent", "delivered", "read", "failed"].includes(status)) return;
  await database().query(
    `UPDATE app_campaign_recipients SET status = $3,
       error = CASE WHEN $3 = 'failed' THEN $4 ELSE error END, updated_at = now()
     WHERE workspace_id = $1::uuid AND wam_id = $2
       AND (
         ($3 = 'failed' AND status = 'sent')
         OR ($3 <> 'failed' AND
           (CASE status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 99 END)
           < (CASE $3 WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END))
       )`,
    [workspaceId, wamId, status, error ? error.slice(0, 500) : null]
  );
}

// ------------------------------------------------------------ pacing and send log

/** The quality rating last synced from Meta for a workspace's WhatsApp number, or null if none is recorded. */
export async function getChannelQualityRating(workspaceId: string, phoneNumberId: string): Promise<string | null> {
  const rows = await database().query(
    `SELECT quality_rating AS "qualityRating" FROM app_whatsapp_channels
     WHERE workspace_id = $1::uuid AND phone_number_id = $2 LIMIT 1`,
    [workspaceId, phoneNumberId]
  );
  const row = rows[0] as { qualityRating: string | null } | undefined;
  return row?.qualityRating ?? null;
}

/**
 * Sends from one WhatsApp number in the rolling window that Meta accepted or left uncertain.
 * Rejected attempts are not counted because Meta did not start a conversation for them.
 */
export async function countNumberSendsInWindow(workspaceId: string, phoneNumberId: string, hours: number): Promise<number> {
  const rows = await database().query(
    `SELECT count(*)::int AS sends FROM app_campaign_send_attempts a
     WHERE a.campaign_id IN (
         SELECT c.id FROM app_campaigns c WHERE c.workspace_id = $1::uuid AND c.phone_number_id = $2
       )
       AND a.outcome IN ('accepted', 'uncertain')
       AND a.attempted_at > now() - make_interval(hours => $3::int)`,
    [workspaceId, phoneNumberId, hours]
  );
  return Number((rows[0] as { sends: number } | undefined)?.sends ?? 0);
}

export type SendOutcome = "accepted" | "rejected" | "uncertain";

/** Durable log of one send attempt. Written after the recipient's status is settled. */
export async function recordSendAttempt(input: {
  campaignId: string;
  recipientId: string;
  outcome: SendOutcome;
  httpStatus: number | null;
  metaCode: number | null;
  error: string | null;
}): Promise<void> {
  await database().query(
    `INSERT INTO app_campaign_send_attempts
       (campaign_id, recipient_id, outcome, http_status, meta_code, error)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)`,
    [input.campaignId, input.recipientId, input.outcome, input.httpStatus, input.metaCode,
      input.error ? input.error.slice(0, 500) : null]
  );
}

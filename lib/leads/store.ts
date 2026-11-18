import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { DEFAULT_STAGE_NAME, type ButtonTap, type LeadSource } from "./rules";

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

export type LeadStage = {
  id: string;
  name: string;
  position: number;
  isDefault: boolean;
  leadCount: number;
};

export type Lead = {
  id: string;
  contactId: string;
  stageId: string;
  stageName: string;
  name: string;
  phoneNumber: string;
  source: LeadSource;
  lastButtonText: string;
  campaignRef: string | null;
  tapCount: number;
  firstTappedAt: string;
  lastTappedAt: string;
};

export type LeadFilters = {
  q?: string;
  source?: LeadSource;
  fromIso?: string | null; // inclusive lower bound on last tap
  toIsoExclusive?: string | null; // exclusive upper bound on last tap
  stageId?: string | null;
  limit: number;
};

const LEAD_COLUMNS = `
  l.id, l.contact_id AS "contactId", l.stage_id AS "stageId", s.name AS "stageName",
  c.name, c.phone_number AS "phoneNumber", l.source, l.last_button_text AS "lastButtonText",
  l.campaign_ref AS "campaignRef", l.tap_count AS "tapCount",
  to_char(l.first_tapped_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "firstTappedAt",
  to_char(l.last_tapped_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "lastTappedAt"`;

const LEAD_FROM = `
  FROM app_leads l
  JOIN app_inbox_contacts c ON c.id = l.contact_id AND c.workspace_id = l.workspace_id
  JOIN app_lead_stages s ON s.id = l.stage_id AND s.workspace_id = l.workspace_id`;

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

/** Creates the default "New" stage if the workspace has none. Safe to call repeatedly. */
export async function ensureDefaultStage(workspaceId: string): Promise<void> {
  await database().query(
    `INSERT INTO app_lead_stages (id, workspace_id, name, position, is_default)
     VALUES ($1::uuid, $2::uuid, $3, 0, true)
     ON CONFLICT DO NOTHING`,
    [randomUUID(), workspaceId, DEFAULT_STAGE_NAME],
  );
}

export async function listStages(workspaceId: string): Promise<LeadStage[]> {
  await ensureDefaultStage(workspaceId);
  const rows = await database().query(
    `SELECT s.id, s.name, s.position, s.is_default AS "isDefault", COUNT(l.id)::int AS "leadCount"
     FROM app_lead_stages s
     LEFT JOIN app_leads l ON l.stage_id = s.id AND l.workspace_id = s.workspace_id
     WHERE s.workspace_id = $1::uuid
     GROUP BY s.id
     ORDER BY s.position ASC, s.created_at ASC`,
    [workspaceId],
  );
  return rows as LeadStage[];
}

export async function createStage(workspaceId: string, name: string): Promise<LeadStage | undefined> {
  await ensureDefaultStage(workspaceId);
  const rows = await database().query(
    `INSERT INTO app_lead_stages (id, workspace_id, name, position, is_default)
     VALUES ($1::uuid, $2::uuid, $3, (
       SELECT COALESCE(MAX(position), -1) + 1 FROM app_lead_stages WHERE workspace_id = $2::uuid
     ), false)
     RETURNING id, name, position, is_default AS "isDefault", 0::int AS "leadCount"`,
    [randomUUID(), workspaceId, name],
  );
  return rows[0] as LeadStage | undefined;
}

export async function renameStage(workspaceId: string, stageId: string, name: string): Promise<LeadStage | undefined> {
  const rows = await database().query(
    `UPDATE app_lead_stages SET name = $3, updated_at = now()
     WHERE workspace_id = $1::uuid AND id = $2::uuid
     RETURNING id, name, position, is_default AS "isDefault", 0::int AS "leadCount"`,
    [workspaceId, stageId, name],
  );
  return rows[0] as LeadStage | undefined;
}

/**
 * Sets positions from the given order. Returns false unless the list names every stage
 * in the workspace exactly once, so a stale client cannot drop a stage from the order.
 */
export async function reorderStages(workspaceId: string, orderedIds: string[]): Promise<boolean> {
  const existing = await database().query(
    `SELECT id FROM app_lead_stages WHERE workspace_id = $1::uuid`,
    [workspaceId],
  ) as { id: string }[];
  const known = new Set(existing.map((row) => row.id));
  if (orderedIds.length !== known.size || new Set(orderedIds).size !== orderedIds.length) return false;
  if (!orderedIds.every((id) => known.has(id))) return false;

  await database().query(
    `UPDATE app_lead_stages s SET position = v.ord - 1, updated_at = now()
     FROM unnest($2::uuid[]) WITH ORDINALITY AS v(id, ord)
     WHERE s.workspace_id = $1::uuid AND s.id = v.id`,
    [workspaceId, orderedIds],
  );
  return true;
}

export type DeleteStageResult =
  | { status: "deleted"; movedLeads: number }
  | { status: "protected" }
  | { status: "not_found" };

/**
 * Deletes a stage and moves its leads to the default stage in one statement.
 * The default stage cannot be deleted because new leads are placed there.
 */
export async function deleteStage(workspaceId: string, stageId: string): Promise<DeleteStageResult> {
  const sql = database();
  const found = await sql.query(
    `SELECT is_default AS "isDefault" FROM app_lead_stages WHERE workspace_id = $1::uuid AND id = $2::uuid`,
    [workspaceId, stageId],
  ) as { isDefault: boolean }[];
  if (!found[0]) return { status: "not_found" };
  if (found[0].isDefault) return { status: "protected" };

  const rows = await sql.query(
    `WITH fallback AS (
       SELECT id FROM app_lead_stages WHERE workspace_id = $1::uuid AND is_default
     ), moved AS (
       UPDATE app_leads SET stage_id = (SELECT id FROM fallback), updated_at = now()
       WHERE workspace_id = $1::uuid AND stage_id = $2::uuid AND EXISTS (SELECT 1 FROM fallback)
       RETURNING id
     ), removed AS (
       DELETE FROM app_lead_stages
       WHERE workspace_id = $1::uuid AND id = $2::uuid AND NOT is_default
       RETURNING id
     )
     SELECT (SELECT COUNT(*)::int FROM moved) AS "movedLeads",
       (SELECT COUNT(*)::int FROM removed) AS "removed"`,
    [workspaceId, stageId],
  ) as { movedLeads: number; removed: number }[];

  if (!rows[0] || rows[0].removed === 0) return { status: "not_found" };
  return { status: "deleted", movedLeads: rows[0].movedLeads };
}

export async function listLeads(workspaceId: string, filters: LeadFilters): Promise<Lead[]> {
  const q = filters.q?.trim() ? likePattern(filters.q.trim()) : null;
  const rows = await database().query(
    `SELECT ${LEAD_COLUMNS}
     ${LEAD_FROM}
     WHERE l.workspace_id = $1::uuid
       AND ($2::text IS NULL OR c.name ILIKE $2::text OR c.phone_number ILIKE $2::text)
       AND ($3::text IS NULL OR l.source = $3::text)
       AND ($4::timestamptz IS NULL OR l.last_tapped_at >= $4::timestamptz)
       AND ($5::timestamptz IS NULL OR l.last_tapped_at < $5::timestamptz)
       AND ($6::uuid IS NULL OR l.stage_id = $6::uuid)
     ORDER BY l.last_tapped_at DESC, l.id DESC
     LIMIT $7::int`,
    [
      workspaceId,
      q,
      filters.source ?? null,
      filters.fromIso ?? null,
      filters.toIsoExclusive ?? null,
      filters.stageId ?? null,
      filters.limit,
    ],
  );
  return rows as Lead[];
}

export async function moveLead(workspaceId: string, leadId: string, stageId: string): Promise<boolean> {
  const rows = await database().query(
    `UPDATE app_leads l SET stage_id = $3::uuid, updated_at = now()
     WHERE l.workspace_id = $1::uuid AND l.id = $2::uuid
       AND EXISTS (SELECT 1 FROM app_lead_stages s WHERE s.workspace_id = $1::uuid AND s.id = $3::uuid)
     RETURNING l.id`,
    [workspaceId, leadId, stageId],
  );
  return rows.length > 0;
}

/**
 * Records one button tap and upserts the contact's lead. A tap whose Meta message id was already
 * stored (webhook retry) changes nothing. New leads land on the default stage. Existing leads keep
 * their stage. Returns false for a duplicate tap.
 */
export async function recordButtonTap(workspaceId: string, contactId: string, tap: ButtonTap): Promise<boolean> {
  await ensureDefaultStage(workspaceId);
  const rows = await database().query(
    `WITH tap AS (
       INSERT INTO app_lead_taps (id, workspace_id, contact_id, wam_id, source, button_text, button_payload,
         context_wam_id, campaign_ref, tapped_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::text, $5::text, $6::text, $7::text, $8::text, $9::text, $10::timestamptz)
       ON CONFLICT (workspace_id, wam_id) DO NOTHING
       RETURNING id
     ), stage AS (
       SELECT id FROM app_lead_stages WHERE workspace_id = $2::uuid AND is_default
     )
     INSERT INTO app_leads (id, workspace_id, contact_id, stage_id, source, last_button_text, last_button_payload,
       campaign_ref, tap_count, first_tapped_at, last_tapped_at)
     SELECT $11::uuid, $2::uuid, $3::uuid, stage.id, $5::text, $6::text, $7::text, $9::text, 1,
       $10::timestamptz, $10::timestamptz
     FROM stage CROSS JOIN tap
     ON CONFLICT (workspace_id, contact_id) DO UPDATE SET
       tap_count = app_leads.tap_count + 1,
       first_tapped_at = LEAST(app_leads.first_tapped_at, EXCLUDED.first_tapped_at),
       source = CASE WHEN EXCLUDED.last_tapped_at >= app_leads.last_tapped_at THEN EXCLUDED.source ELSE app_leads.source END,
       last_button_text = CASE WHEN EXCLUDED.last_tapped_at >= app_leads.last_tapped_at
         THEN EXCLUDED.last_button_text ELSE app_leads.last_button_text END,
       last_button_payload = CASE WHEN EXCLUDED.last_tapped_at >= app_leads.last_tapped_at
         THEN EXCLUDED.last_button_payload ELSE app_leads.last_button_payload END,
       campaign_ref = COALESCE(EXCLUDED.campaign_ref, app_leads.campaign_ref),
       last_tapped_at = GREATEST(app_leads.last_tapped_at, EXCLUDED.last_tapped_at),
       updated_at = now()
     RETURNING id`,
    [
      randomUUID(),
      workspaceId,
      contactId,
      tap.wamId,
      tap.source,
      tap.buttonText,
      tap.buttonPayload,
      tap.contextWamId,
      tap.campaignRef,
      tap.tappedAt,
      randomUUID(),
    ],
  );
  return rows.length > 0;
}

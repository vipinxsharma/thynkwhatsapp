import { neon } from "@neondatabase/serverless";
import type { CatalogHit } from "./chat";

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

export interface AiChatSettings {
  enabled: boolean;
  faqText: string | null;
  handoverContact: string | null;
  updatedAt: string | null;
}

export const emptyAiChatSettings: AiChatSettings = {
  enabled: false, faqText: null, handoverContact: null, updatedAt: null,
};

export async function getAiChatSettings(workspaceId: string): Promise<AiChatSettings> {
  const rows = await database().query(
    `SELECT enabled, faq_text AS "faqText", handover_contact AS "handoverContact", updated_at AS "updatedAt"
     FROM app_ai_chat_settings WHERE workspace_id = $1::uuid`,
    [workspaceId],
  ) as AiChatSettings[];
  return rows[0] ? { ...emptyAiChatSettings, ...rows[0], enabled: Boolean(rows[0].enabled) } : emptyAiChatSettings;
}

export async function saveAiChatSettings(
  workspaceId: string,
  userId: string,
  input: { enabled: boolean; faqText: string | null; handoverContact: string | null },
): Promise<AiChatSettings> {
  const rows = await database().query(
    `INSERT INTO app_ai_chat_settings (workspace_id, enabled, faq_text, handover_contact, updated_by, updated_at)
     VALUES ($1::uuid, $2, $3, $4, $5, now())
     ON CONFLICT (workspace_id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       faq_text = EXCLUDED.faq_text,
       handover_contact = EXCLUDED.handover_contact,
       updated_by = EXCLUDED.updated_by,
       updated_at = now()
     RETURNING enabled, faq_text AS "faqText", handover_contact AS "handoverContact", updated_at AS "updatedAt"`,
    [workspaceId, input.enabled, input.faqText, input.handoverContact, userId],
  ) as AiChatSettings[];
  return { ...rows[0], enabled: Boolean(rows[0].enabled) };
}

/**
 * Catalogue products for the workspace. The catalogue table is owned by another feature and may
 * not exist yet, so a missing table or an unexpected shape returns an empty list.
 */
export async function loadCatalogueHits(workspaceId: string): Promise<CatalogHit[]> {
  try {
    const sql = database();
    const present = await sql.query(`SELECT to_regclass('public.app_catalog_products') IS NOT NULL AS present`) as Array<{ present: boolean }>;
    if (!present[0]?.present) return [];
    const rows = await sql.query(
      `SELECT name, description FROM app_catalog_products WHERE workspace_id = $1::uuid LIMIT 200`,
      [workspaceId],
    ) as Array<{ name: string | null; description: string | null }>;
    return rows
      .filter((row) => row.name && row.description)
      .map((row) => ({ name: String(row.name), text: String(row.description) }));
  } catch (error) {
    console.warn("[AI Chat] catalogue unavailable, using FAQ only", error instanceof Error ? error.message : error);
    return [];
  }
}

/** True when a rule-based reply was already planned for this inbound message. Avoids a double reply. */
export async function ruleReplyExistsForMessage(workspaceId: string, wamId: string): Promise<boolean> {
  const rows = await database().query(
    `SELECT 1 AS found FROM app_automation_runs
     WHERE workspace_id = $1::uuid AND wam_id = $2
       AND applied_actions->'reply' IS NOT NULL AND jsonb_typeof(applied_actions->'reply') = 'object'
     LIMIT 1`,
    [workspaceId, wamId],
  ) as Array<{ found: number }>;
  return rows.length > 0;
}

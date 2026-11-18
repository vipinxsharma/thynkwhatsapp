import { neon } from "@neondatabase/serverless";
import type { CrmCode } from "@/lib/crm/options";

export interface CrmChoice {
  crmCode: CrmCode;
  status: "requested" | "provisioned";
  updatedAt: string;
}

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

function toChoice(row: unknown): CrmChoice | null {
  if (!row) return null;
  const value = row as { crmCode: CrmCode; status: CrmChoice["status"]; updatedAt: string | Date };
  return { crmCode: value.crmCode, status: value.status, updatedAt: new Date(value.updatedAt).toISOString() };
}

const columns = `crm_code AS "crmCode", status, updated_at AS "updatedAt"`;

export async function getCrmChoice(workspaceId: string): Promise<CrmChoice | null> {
  const rows = await database().query(
    `SELECT ${columns} FROM app_workspace_crm_choices WHERE workspace_id = $1::uuid`,
    [workspaceId]
  );
  return toChoice(rows[0]);
}

/**
 * Saves the workspace's CRM choice. A choice that is already provisioned is never
 * overwritten: the stored row is returned unchanged so the caller can tell.
 */
export async function saveCrmChoice(input: {
  workspaceId: string;
  crmCode: CrmCode;
  authUserId: string;
  contactEmail: string;
}): Promise<CrmChoice> {
  const db = database();
  const rows = await db.query(
    `INSERT INTO app_workspace_crm_choices (workspace_id, crm_code, chosen_by_auth_user_id, contact_email)
     VALUES ($1::uuid, $2, $3, $4)
     ON CONFLICT (workspace_id) DO UPDATE SET
       crm_code = EXCLUDED.crm_code,
       chosen_by_auth_user_id = EXCLUDED.chosen_by_auth_user_id,
       contact_email = EXCLUDED.contact_email,
       updated_at = now()
     WHERE app_workspace_crm_choices.status = 'requested'
     RETURNING ${columns}`,
    [input.workspaceId, input.crmCode, input.authUserId, input.contactEmail]
  );
  const saved = toChoice(rows[0]) ?? (await getCrmChoice(input.workspaceId));
  if (!saved) throw new Error("CRM choice could not be saved");
  return saved;
}

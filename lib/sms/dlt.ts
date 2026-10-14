import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

export type DltAccessProvider = "airtel" | "vi" | "jio" | "other";

export interface DltDraft {
  accessProvider: DltAccessProvider;
  principalEntityId: string | null;
  deliveryPartnerName: string | null;
  updatedAt: string;
}

export type DltDraftInput = Pick<DltDraft, "accessProvider" | "principalEntityId" | "deliveryPartnerName">;

export function parseDltDraft(value: unknown): DltDraftInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (!["airtel", "vi", "jio", "other"].includes(String(input.accessProvider))) return null;
  const principalEntityId = input.principalEntityId;
  const deliveryPartnerName = input.deliveryPartnerName;
  if (principalEntityId !== null && principalEntityId !== undefined && typeof principalEntityId !== "string") return null;
  if (deliveryPartnerName !== null && deliveryPartnerName !== undefined && typeof deliveryPartnerName !== "string") return null;
  const peId = (principalEntityId || "").trim();
  const partner = (deliveryPartnerName || "").trim();
  if (peId.length > 64 || (peId && !/^[A-Za-z0-9_-]+$/.test(peId))) return null;
  if (partner.length > 120 || /[\x00-\x1f\x7f]/.test(partner)) return null;
  return {
    accessProvider: input.accessProvider as DltAccessProvider,
    principalEntityId: peId || null,
    deliveryPartnerName: partner || null,
  };
}

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

export async function getDltDraft(workspaceId: string): Promise<DltDraft | null> {
  const rows = await database().query(
    `SELECT access_provider AS "accessProvider", principal_entity_id AS "principalEntityId",
      delivery_partner_name AS "deliveryPartnerName", updated_at AS "updatedAt"
     FROM app_sms_dlt_drafts WHERE workspace_id = $1::uuid`,
    [workspaceId]
  );
  return (rows[0] as DltDraft | undefined) || null;
}

export async function saveDltDraft(workspaceId: string, userId: string, input: DltDraftInput): Promise<DltDraft> {
  const rows = await database().query(
    `WITH saved AS (
       INSERT INTO app_sms_dlt_drafts
         (workspace_id, access_provider, principal_entity_id, delivery_partner_name, updated_by_auth_user_id)
       VALUES ($1::uuid, $2, $3, $4, $5)
       ON CONFLICT (workspace_id) DO UPDATE SET
         access_provider = EXCLUDED.access_provider,
         principal_entity_id = EXCLUDED.principal_entity_id,
         delivery_partner_name = EXCLUDED.delivery_partner_name,
         updated_by_auth_user_id = EXCLUDED.updated_by_auth_user_id,
         updated_at = now()
       RETURNING workspace_id, access_provider, principal_entity_id, delivery_partner_name, updated_at
     ), audited AS (
       INSERT INTO app_audit_logs (id, workspace_id, auth_user_id, action, resource_type, resource_id)
       SELECT $6::uuid, workspace_id, $5, 'sms.dlt_draft.saved', 'sms_dlt_draft', workspace_id::text
       FROM saved
     )
     SELECT access_provider AS "accessProvider", principal_entity_id AS "principalEntityId",
       delivery_partner_name AS "deliveryPartnerName", updated_at AS "updatedAt" FROM saved`,
    [workspaceId, input.accessProvider, input.principalEntityId, input.deliveryPartnerName, userId, crypto.randomUUID()]
  );
  return rows[0] as DltDraft;
}

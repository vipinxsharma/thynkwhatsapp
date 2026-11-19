import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export function developerDatabase() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

export function developerStorageConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Writes one row to the workspace audit log (app_audit_logs, created in migration 0001). */
export async function recordAuditEvent(input: {
  workspaceId: string;
  authUserId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await developerDatabase().query(
    `INSERT INTO app_audit_logs (id, workspace_id, auth_user_id, action, resource_type, resource_id, metadata)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb)`,
    [
      randomUUID(),
      input.workspaceId,
      input.authUserId,
      input.action,
      input.resourceType,
      input.resourceId,
      JSON.stringify(input.metadata || {}),
    ],
  );
}

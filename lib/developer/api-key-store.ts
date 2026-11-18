import { randomUUID } from "node:crypto";
import { developerDatabase, recordAuditEvent } from "@/lib/developer/db";
import { generateApiKey, hashApiKey } from "@/lib/developer/keys";

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface AuthenticatedApiKey {
  id: string;
  workspaceId: string;
  name: string;
  createdByAuthUserId: string;
}

export async function createApiKey(input: {
  workspaceId: string;
  authUserId: string;
  name: string;
}): Promise<ApiKeySummary & { key: string }> {
  const generated = generateApiKey();
  const id = randomUUID();
  const rows = await developerDatabase().query(
    `INSERT INTO app_api_keys (id, workspace_id, name, key_prefix, key_hash, created_by_auth_user_id)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
     RETURNING id, name, key_prefix AS "prefix", created_at AS "createdAt",
       last_used_at AS "lastUsedAt", revoked_at AS "revokedAt"`,
    [id, input.workspaceId, input.name, generated.prefix, generated.hash, input.authUserId],
  );
  const created = rows[0] as ApiKeySummary;
  await recordAuditEvent({
    workspaceId: input.workspaceId,
    authUserId: input.authUserId,
    action: "api_key.created",
    resourceType: "api_key",
    resourceId: id,
    metadata: { name: input.name, prefix: generated.prefix },
  });
  return { ...created, key: generated.key };
}

export async function listApiKeys(workspaceId: string): Promise<ApiKeySummary[]> {
  const rows = await developerDatabase().query(
    `SELECT id, name, key_prefix AS "prefix", created_at AS "createdAt",
       last_used_at AS "lastUsedAt", revoked_at AS "revokedAt"
     FROM app_api_keys WHERE workspace_id = $1::uuid
     ORDER BY created_at DESC LIMIT 100`,
    [workspaceId],
  );
  return rows as ApiKeySummary[];
}

export async function revokeApiKey(input: {
  workspaceId: string;
  authUserId: string;
  keyId: string;
}): Promise<boolean> {
  const rows = await developerDatabase().query(
    `UPDATE app_api_keys SET revoked_at = now(), revoked_by_auth_user_id = $3
     WHERE workspace_id = $1::uuid AND id = $2::uuid AND revoked_at IS NULL
     RETURNING id, name, key_prefix AS "prefix"`,
    [input.workspaceId, input.keyId, input.authUserId],
  );
  const revoked = rows[0] as { id: string; name: string; prefix: string } | undefined;
  if (!revoked) return false;
  await recordAuditEvent({
    workspaceId: input.workspaceId,
    authUserId: input.authUserId,
    action: "api_key.revoked",
    resourceType: "api_key",
    resourceId: revoked.id,
    metadata: { name: revoked.name, prefix: revoked.prefix },
  });
  return true;
}

/** Resolves a presented key to its workspace. Revoked and unknown keys resolve to null. */
export async function authenticateApiKey(presentedKey: string): Promise<AuthenticatedApiKey | null> {
  const rows = await developerDatabase().query(
    `UPDATE app_api_keys SET last_used_at = now()
     WHERE key_hash = $1 AND revoked_at IS NULL
     RETURNING id, workspace_id AS "workspaceId", name, created_by_auth_user_id AS "createdByAuthUserId"`,
    [hashApiKey(presentedKey)],
  );
  return (rows[0] as AuthenticatedApiKey | undefined) || null;
}

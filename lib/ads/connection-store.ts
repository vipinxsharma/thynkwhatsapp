import { neon } from "@neondatabase/serverless";
import type { EncryptedData } from "@/lib/meta/encryption";
import type { AdAccountSummary } from "./graph";

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

export type AdsConnectionStatus = {
  status: "connected" | "disconnected";
  adAccounts: AdAccountSummary[];
  connectedAt: string | null;
  disconnectedAt: string | null;
  tokenExpiresAt: string | null;
};

/** Stores or replaces the workspace's ads connection. The token arrives already encrypted. */
export async function saveAdsConnection(input: {
  workspaceId: string;
  authUserId: string;
  metaUserId: string;
  encryptedToken: EncryptedData;
  tokenExpiresAt: string | null;
  adAccounts: AdAccountSummary[];
}): Promise<void> {
  await database().query(
    `INSERT INTO app_ad_account_connections (
       workspace_id, status, scope, meta_user_id, ad_accounts, encrypted_access_token,
       access_token_iv, access_token_tag, token_expires_at, connected_by_auth_user_id, connected_at, updated_at
     ) VALUES ($1::uuid, 'connected', 'ads_read', $2::text, $3::jsonb, $4::text, $5::text, $6::text,
       $7::timestamptz, $8::text, now(), now())
     ON CONFLICT (workspace_id) DO UPDATE SET
       status = 'connected',
       scope = 'ads_read',
       meta_user_id = EXCLUDED.meta_user_id,
       ad_accounts = EXCLUDED.ad_accounts,
       encrypted_access_token = EXCLUDED.encrypted_access_token,
       access_token_iv = EXCLUDED.access_token_iv,
       access_token_tag = EXCLUDED.access_token_tag,
       token_expires_at = EXCLUDED.token_expires_at,
       connected_by_auth_user_id = EXCLUDED.connected_by_auth_user_id,
       connected_at = now(),
       disconnected_at = NULL,
       updated_at = now()`,
    [
      input.workspaceId,
      input.metaUserId,
      JSON.stringify(input.adAccounts),
      input.encryptedToken.ciphertext,
      input.encryptedToken.iv,
      input.encryptedToken.authTag,
      input.tokenExpiresAt,
      input.authUserId,
    ],
  );
}

/** Status for the settings screen. Never returns the token. */
export async function getAdsConnection(workspaceId: string): Promise<AdsConnectionStatus | null> {
  const rows = await database().query(
    `SELECT status, ad_accounts AS "adAccounts",
       to_char(connected_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "connectedAt",
       to_char(disconnected_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "disconnectedAt",
       to_char(token_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "tokenExpiresAt"
     FROM app_ad_account_connections WHERE workspace_id = $1::uuid`,
    [workspaceId],
  ) as Array<Omit<AdsConnectionStatus, "adAccounts"> & { adAccounts: AdAccountSummary[] }>;
  const row = rows[0];
  if (!row) return null;
  return {
    status: row.status,
    adAccounts: Array.isArray(row.adAccounts) ? row.adAccounts : [],
    connectedAt: row.connectedAt,
    disconnectedAt: row.disconnectedAt,
    tokenExpiresAt: row.tokenExpiresAt,
  };
}

/** The encrypted token for a connected workspace, used only to revoke the grant at Meta. */
export async function getEncryptedAdsToken(workspaceId: string): Promise<EncryptedData | null> {
  const rows = await database().query(
    `SELECT encrypted_access_token AS ciphertext, access_token_iv AS iv, access_token_tag AS "authTag"
     FROM app_ad_account_connections
     WHERE workspace_id = $1::uuid AND status = 'connected'`,
    [workspaceId],
  ) as Array<{ ciphertext: string | null; iv: string | null; authTag: string | null }>;
  const row = rows[0];
  if (!row?.ciphertext || !row.iv || !row.authTag) return null;
  return { ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag };
}

/** Drops the token and account list and keeps the row as an audit trail. */
export async function markAdsDisconnected(workspaceId: string): Promise<boolean> {
  const rows = await database().query(
    `UPDATE app_ad_account_connections SET
       status = 'disconnected',
       encrypted_access_token = NULL,
       access_token_iv = NULL,
       access_token_tag = NULL,
       token_expires_at = NULL,
       ad_accounts = '[]'::jsonb,
       disconnected_at = now(),
       updated_at = now()
     WHERE workspace_id = $1::uuid AND status = 'connected'
     RETURNING workspace_id`,
    [workspaceId],
  );
  return rows.length > 0;
}

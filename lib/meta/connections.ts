import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { decryptToken, encryptToken, type EncryptedData } from "@/lib/meta/encryption";

export interface MetaPhoneOwnership {
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
}

export interface MetaConnection extends MetaPhoneOwnership {
  workspaceId: string;
  accessToken: string;
}

export interface WhatsAppChannel extends MetaPhoneOwnership {
  channelName: string;
  enabled: boolean;
  isDefault: boolean;
  metaStatus: string | null;
  qualityRating: string | null;
  codeVerificationStatus: string | null;
  lastSyncedAt: string | null;
}

export function validMetaIdentifier(value: string): boolean {
  return /^\d{5,30}$/.test(value);
}

function database() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  return neon(databaseUrl);
}

export async function saveMetaConnection(input: {
  workspaceId: string;
  authUserId: string;
  ownership: MetaPhoneOwnership;
  encryptedToken: EncryptedData;
  channelName: string;
}): Promise<void> {
  const sql = database();
  const { ownership, encryptedToken } = input;
  const account = await sql.query(
    `INSERT INTO app_waba_connections (
       id, workspace_id, waba_id, phone_number_id, display_phone_number, verified_name,
       encrypted_access_token, access_token_iv, access_token_tag, webhook_subscribed,
       status, connected_by_auth_user_id
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, true, 'connected', $10)
     ON CONFLICT (waba_id) DO UPDATE SET
       encrypted_access_token = EXCLUDED.encrypted_access_token,
       access_token_iv = EXCLUDED.access_token_iv,
       access_token_tag = EXCLUDED.access_token_tag,
       webhook_subscribed = true,
       status = 'connected',
       connected_by_auth_user_id = EXCLUDED.connected_by_auth_user_id,
       updated_at = now()
     WHERE app_waba_connections.workspace_id = EXCLUDED.workspace_id
     RETURNING waba_id`,
    [
      crypto.randomUUID(),
      input.workspaceId,
      ownership.wabaId,
      ownership.phoneNumberId,
      ownership.displayPhoneNumber || null,
      ownership.verifiedName || null,
      encryptedToken.ciphertext,
      encryptedToken.iv,
      encryptedToken.authTag,
      input.authUserId,
    ]
  );
  if (!account.length) throw new Error("This WABA is already connected to another workspace");
  const channel = await sql.query(
    `INSERT INTO app_whatsapp_channels (
       phone_number_id, workspace_id, waba_id, display_phone_number, verified_name, channel_name
     ) VALUES ($1, $2::uuid, $3, $4, $5, $6)
     ON CONFLICT (phone_number_id) DO UPDATE SET
       display_phone_number = EXCLUDED.display_phone_number,
       verified_name = EXCLUDED.verified_name,
       channel_name = EXCLUDED.channel_name,
       enabled = true, updated_at = now()
     WHERE app_whatsapp_channels.workspace_id = EXCLUDED.workspace_id
       AND app_whatsapp_channels.waba_id = EXCLUDED.waba_id
     RETURNING phone_number_id`,
    [ownership.phoneNumberId, input.workspaceId, ownership.wabaId,
      ownership.displayPhoneNumber || null, ownership.verifiedName || null, input.channelName]
  );
  if (!channel.length) throw new Error("This phone number is already connected to another workspace or WABA");
  await sql.query(
    `INSERT INTO app_workspace_channel_defaults (workspace_id, phone_number_id)
     VALUES ($1::uuid, $2) ON CONFLICT (workspace_id) DO NOTHING`,
    [input.workspaceId, ownership.phoneNumberId]
  );
}

type ConnectionRow = {
  workspaceId: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  ciphertext: string;
  iv: string;
  authTag: string;
};

function rowToConnection(row: ConnectionRow): MetaConnection {
  return {
    workspaceId: row.workspaceId,
    wabaId: row.wabaId,
    phoneNumberId: row.phoneNumberId,
    displayPhoneNumber: row.displayPhoneNumber || undefined,
    verifiedName: row.verifiedName || undefined,
    accessToken: decryptToken({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag }),
  };
}

const selectConnection = `SELECT a.workspace_id AS "workspaceId", a.waba_id AS "wabaId",
  c.phone_number_id AS "phoneNumberId", c.display_phone_number AS "displayPhoneNumber",
  c.verified_name AS "verifiedName", a.encrypted_access_token AS ciphertext,
  a.access_token_iv AS iv, a.access_token_tag AS "authTag"
  FROM app_whatsapp_channels c
  JOIN app_waba_connections a ON a.waba_id = c.waba_id AND a.workspace_id = c.workspace_id`;

export async function getMetaConnectionForWorkspace(workspaceId: string): Promise<MetaConnection> {
  const rows = await database().query(
    `${selectConnection}
     JOIN app_workspace_channel_defaults d ON d.workspace_id = c.workspace_id
       AND d.phone_number_id = c.phone_number_id
     WHERE c.workspace_id = $1::uuid AND c.enabled AND a.status = 'connected' LIMIT 1`,
    [workspaceId]
  );
  const row = rows[0] as ConnectionRow | undefined;
  if (!row) throw new Error("No connected WhatsApp Business Account for this workspace");
  return rowToConnection(row);
}

export async function getMetaConnectionForNumber(workspaceId: string, phoneNumberId: string): Promise<MetaConnection | null> {
  const rows = await database().query(
    `${selectConnection} WHERE c.workspace_id = $1::uuid AND c.phone_number_id = $2
      AND c.enabled AND a.status = 'connected' LIMIT 1`,
    [workspaceId, phoneNumberId]
  );
  const row = rows[0] as ConnectionRow | undefined;
  return row ? rowToConnection(row) : null;
}

export async function getMetaConnectionForWaba(wabaId: string, phoneNumberId: string): Promise<MetaConnection | null> {
  const rows = await database().query(
    `${selectConnection} WHERE a.waba_id = $1 AND c.phone_number_id = $2
      AND c.enabled AND a.status = 'connected' LIMIT 1`,
    [wabaId, phoneNumberId]
  );
  const row = rows[0] as ConnectionRow | undefined;
  return row ? rowToConnection(row) : null;
}

export async function listWhatsAppChannels(workspaceId: string): Promise<WhatsAppChannel[]> {
  const rows = await database().query(
    `SELECT c.waba_id AS "wabaId", c.phone_number_id AS "phoneNumberId",
      c.display_phone_number AS "displayPhoneNumber", c.verified_name AS "verifiedName",
      c.channel_name AS "channelName", c.enabled, c.meta_status AS "metaStatus",
      c.quality_rating AS "qualityRating", c.code_verification_status AS "codeVerificationStatus",
      c.last_synced_at AS "lastSyncedAt", d.phone_number_id IS NOT NULL AS "isDefault"
     FROM app_whatsapp_channels c
     LEFT JOIN app_workspace_channel_defaults d ON d.workspace_id = c.workspace_id
       AND d.phone_number_id = c.phone_number_id
     WHERE c.workspace_id = $1::uuid ORDER BY c.connected_at, c.phone_number_id`,
    [workspaceId]
  );
  return rows as unknown as WhatsAppChannel[];
}

export async function renameWhatsAppChannel(workspaceId: string, phoneNumberId: string, name: string): Promise<boolean> {
  const rows = await database().query(
    `UPDATE app_whatsapp_channels SET channel_name = $3, updated_at = now()
     WHERE workspace_id = $1::uuid AND phone_number_id = $2 RETURNING phone_number_id`,
    [workspaceId, phoneNumberId, name]
  );
  return rows.length > 0;
}

export async function setDefaultWhatsAppChannel(workspaceId: string, phoneNumberId: string): Promise<boolean> {
  const rows = await database().query(
    `INSERT INTO app_workspace_channel_defaults (workspace_id, phone_number_id)
     SELECT c.workspace_id, c.phone_number_id FROM app_whatsapp_channels c
     JOIN app_waba_connections a ON a.waba_id = c.waba_id AND a.workspace_id = c.workspace_id
     WHERE c.workspace_id = $1::uuid AND c.phone_number_id = $2
       AND c.enabled AND a.status = 'connected'
     ON CONFLICT (workspace_id) DO UPDATE SET
       phone_number_id = EXCLUDED.phone_number_id, updated_at = now()
     RETURNING phone_number_id`,
    [workspaceId, phoneNumberId]
  );
  return rows.length > 0;
}

export async function syncWhatsAppChannelStatus(input: {
  workspaceId: string; wabaId: string; phoneNumberId: string;
  displayPhoneNumber?: string; verifiedName?: string; metaStatus?: string;
  qualityRating?: string; codeVerificationStatus?: string;
}): Promise<boolean> {
  const rows = await database().query(
    `UPDATE app_whatsapp_channels SET
       display_phone_number = COALESCE($4, display_phone_number),
       verified_name = COALESCE($5, verified_name), meta_status = $6,
       quality_rating = $7, code_verification_status = $8,
       last_synced_at = now(), updated_at = now()
     WHERE workspace_id = $1::uuid AND waba_id = $2 AND phone_number_id = $3
     RETURNING phone_number_id`,
    [input.workspaceId, input.wabaId, input.phoneNumberId,
      input.displayPhoneNumber || null, input.verifiedName || null,
      input.metaStatus || null, input.qualityRating || null,
      input.codeVerificationStatus || null]
  );
  return rows.length > 0;
}

/**
 * Marks a WABA connection as no longer usable after Meta reports that the customer removed
 * the app, unshared the account, or deleted it. Returns the affected workspace, if any.
 */
export async function markWabaDisconnected(wabaId: string): Promise<string | null> {
  if (!validMetaIdentifier(wabaId)) return null;
  const rows = await database().query(
    `UPDATE app_waba_connections SET status = 'disconnected', webhook_subscribed = false, updated_at = now()
     WHERE waba_id = $1 AND status <> 'disconnected' RETURNING workspace_id AS "workspaceId"`,
    [wabaId]
  );
  return (rows[0] as { workspaceId: string } | undefined)?.workspaceId ?? null;
}

export interface TokenCheckCandidate {
  wabaId: string;
  workspaceId: string;
  accessToken: string;
  expiresAt: Date | null;
}

/**
 * Connected WABAs whose token has never been checked, or expires before `before`.
 * Tokens Meta reported as never expiring (checked, no expiry) are skipped.
 */
export async function listTokensToCheck(before: Date, limit: number): Promise<TokenCheckCandidate[]> {
  const rows = (await database().query(
    `SELECT waba_id AS "wabaId", workspace_id AS "workspaceId", encrypted_access_token AS ciphertext,
       access_token_iv AS iv, access_token_tag AS "authTag", token_expires_at AS "expiresAt"
     FROM app_waba_connections
     WHERE status = 'connected'
       AND (token_checked_at IS NULL OR token_expires_at < $1::timestamptz)
     ORDER BY token_expires_at ASC NULLS FIRST LIMIT $2`,
    [before.toISOString(), limit]
  )) as Array<{ wabaId: string; workspaceId: string; ciphertext: string; iv: string; authTag: string; expiresAt: string | Date | null }>;
  return rows.map((row) => ({
    wabaId: row.wabaId,
    workspaceId: row.workspaceId,
    accessToken: decryptToken({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag }),
    expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
  }));
}

/** Records what Meta reported about a stored token, optionally replacing the token itself. */
export async function recordTokenState(input: {
  wabaId: string;
  expiresAt: Date | null;
  newAccessToken?: string;
  error?: string | null;
}): Promise<void> {
  const encrypted = input.newAccessToken ? encryptToken(input.newAccessToken) : null;
  await database().query(
    `UPDATE app_waba_connections SET
       token_expires_at = $2::timestamptz,
       token_checked_at = now(),
       token_refresh_error = $3,
       encrypted_access_token = COALESCE($4, encrypted_access_token),
       access_token_iv = COALESCE($5, access_token_iv),
       access_token_tag = COALESCE($6, access_token_tag),
       updated_at = now()
     WHERE waba_id = $1`,
    [
      input.wabaId,
      input.expiresAt ? input.expiresAt.toISOString() : null,
      input.error ? input.error.slice(0, 500) : null,
      encrypted?.ciphertext ?? null,
      encrypted?.iv ?? null,
      encrypted?.authTag ?? null,
    ]
  );
}

/**
 * Records a failed check without touching the stored token, its known expiry or
 * token_checked_at, so an unchecked connection is retried on the next run.
 */
export async function recordTokenError(wabaId: string, error: string): Promise<void> {
  await database().query(
    `UPDATE app_waba_connections SET token_refresh_error = $2, updated_at = now()
     WHERE waba_id = $1`,
    [wabaId, error.slice(0, 500)]
  );
}

import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { decryptToken, type EncryptedData } from "@/lib/meta/encryption";

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
}): Promise<void> {
  const sql = database();
  const { ownership, encryptedToken } = input;
  await sql.query(
    `INSERT INTO app_waba_connections (
       id, workspace_id, waba_id, phone_number_id, display_phone_number, verified_name,
       encrypted_access_token, access_token_iv, access_token_tag, webhook_subscribed,
       status, connected_by_auth_user_id
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, true, 'connected', $10)
     ON CONFLICT (workspace_id, waba_id) DO UPDATE SET
       phone_number_id = EXCLUDED.phone_number_id,
       display_phone_number = EXCLUDED.display_phone_number,
       verified_name = EXCLUDED.verified_name,
       encrypted_access_token = EXCLUDED.encrypted_access_token,
       access_token_iv = EXCLUDED.access_token_iv,
       access_token_tag = EXCLUDED.access_token_tag,
       webhook_subscribed = true,
       status = 'connected',
       connected_by_auth_user_id = EXCLUDED.connected_by_auth_user_id,
       updated_at = now()`,
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

const selectConnection = `SELECT workspace_id AS "workspaceId", waba_id AS "wabaId",
  phone_number_id AS "phoneNumberId", display_phone_number AS "displayPhoneNumber",
  verified_name AS "verifiedName", encrypted_access_token AS ciphertext,
  access_token_iv AS iv, access_token_tag AS "authTag"
  FROM app_waba_connections`;

export async function getMetaConnectionForWorkspace(workspaceId: string): Promise<MetaConnection> {
  const rows = await database().query(
    `${selectConnection} WHERE workspace_id = $1::uuid AND status = 'connected' LIMIT 1`,
    [workspaceId]
  );
  const row = rows[0] as ConnectionRow | undefined;
  if (!row) throw new Error("No connected WhatsApp Business Account for this workspace");
  return rowToConnection(row);
}

export async function getMetaConnectionForWaba(wabaId: string): Promise<MetaConnection | null> {
  const rows = await database().query(
    `${selectConnection} WHERE waba_id = $1 AND status = 'connected' LIMIT 1`,
    [wabaId]
  );
  const row = rows[0] as ConnectionRow | undefined;
  return row ? rowToConnection(row) : null;
}

import { neon } from "@neondatabase/serverless";
import type { PartnerConnectionRow } from "@/lib/partner-solutions/status";

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

// Reads only status columns. The encrypted access token is never selected.
export async function listPartnerConnections(workspaceId: string): Promise<PartnerConnectionRow[]> {
  const rows = await database().query(
    `SELECT waba_id AS "wabaId", phone_number_id AS "phoneNumberId",
      display_phone_number AS "displayPhoneNumber", verified_name AS "verifiedName",
      status, webhook_subscribed AS "webhookSubscribed",
      token_expires_at AS "tokenExpiresAt", token_checked_at AS "tokenCheckedAt",
      token_refresh_error AS "tokenRefreshError", created_at AS "connectedAt"
     FROM app_waba_connections
     WHERE workspace_id = $1::uuid
     ORDER BY created_at, waba_id`,
    [workspaceId]
  );
  return (rows as unknown as Array<Record<string, unknown>>).map((row) => ({
    wabaId: String(row.wabaId),
    phoneNumberId: String(row.phoneNumberId),
    displayPhoneNumber: (row.displayPhoneNumber as string | null) ?? null,
    verifiedName: (row.verifiedName as string | null) ?? null,
    status: row.status as PartnerConnectionRow["status"],
    webhookSubscribed: Boolean(row.webhookSubscribed),
    tokenExpiresAt: toIso(row.tokenExpiresAt),
    tokenCheckedAt: toIso(row.tokenCheckedAt),
    tokenRefreshError: (row.tokenRefreshError as string | null) ?? null,
    connectedAt: toIso(row.connectedAt) ?? new Date(0).toISOString(),
  }));
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

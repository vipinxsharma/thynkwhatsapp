import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { AdReferral } from "./referral";

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

/**
 * Stores one referral against the inbound message that carried it. Returns false when that message
 * was already recorded (a webhook retry), so a retry never creates a second row.
 */
export async function recordAdAttribution(
  workspaceId: string,
  contactId: string,
  wamId: string,
  referredAt: string,
  referral: AdReferral,
): Promise<boolean> {
  const rows = await database().query(
    `INSERT INTO app_ad_attributions (
       id, workspace_id, contact_id, wam_id, source_type, source_id, source_url,
       headline, body, media_type, ctwa_clid, referred_at
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::text, $5::text, $6::text, $7::text,
       $8::text, $9::text, $10::text, $11::text, $12::timestamptz)
     ON CONFLICT (workspace_id, wam_id) DO NOTHING
     RETURNING id`,
    [
      randomUUID(),
      workspaceId,
      contactId,
      wamId,
      referral.sourceType,
      referral.sourceId,
      referral.sourceUrl,
      referral.headline,
      referral.body,
      referral.mediaType,
      referral.ctwaClid,
      referredAt,
    ],
  );
  return rows.length > 0;
}

export type AdAttributionRow = {
  sourceType: "ad" | "post";
  sourceId: string;
  headline: string;
  referredAt: string;
};

/** Most recent referrals for a contact, newest first. Read-only; used by lead views and reports. */
export async function listAdAttributionsForContact(
  workspaceId: string,
  contactId: string,
  limit = 20,
): Promise<AdAttributionRow[]> {
  const rows = await database().query(
    `SELECT source_type AS "sourceType", source_id AS "sourceId", headline,
       to_char(referred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "referredAt"
     FROM app_ad_attributions
     WHERE workspace_id = $1::uuid AND contact_id = $2::uuid
     ORDER BY referred_at DESC
     LIMIT $3::int`,
    [workspaceId, contactId, Math.min(Math.max(limit, 1), 100)],
  );
  return rows as AdAttributionRow[];
}

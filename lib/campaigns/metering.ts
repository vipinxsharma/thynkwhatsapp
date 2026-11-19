import { neon } from "@neondatabase/serverless";

// Campaigns add-on terms. These mirror lib/billing/addons.ts (added on main in #52). Keep in
// step with it; when this branch is rebased onto main, import the constants from there instead.
const CAMPAIGN_ADDON = {
  monthlyPriceInr: 1499,
  includedSends: 10000,
  extraSendPaisePerSend: 10, // ₹0.10 per send above the quota
} as const;

// India has no daylight saving, so a fixed +05:30 offset gives exact month boundaries.
const KOLKATA_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
export const USAGE_TIMEZONE = "Asia/Kolkata";

/** The calendar month, in Asia/Kolkata, that an instant falls in, as `YYYY-MM`. */
export function kolkataMonthKey(at: Date): string {
  const local = new Date(at.getTime() + KOLKATA_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** The UTC instants where a `YYYY-MM` month starts (inclusive) and ends (exclusive), in Asia/Kolkata. */
export function kolkataMonthBounds(monthKey: string): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) throw new Error(`Invalid month key: ${monthKey}`);
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new Error(`Invalid month key: ${monthKey}`);
  const start = new Date(Date.UTC(year, monthIndex, 1) - KOLKATA_OFFSET_MS);
  const end = new Date(Date.UTC(year, monthIndex + 1, 1) - KOLKATA_OFFSET_MS);
  return { start, end };
}

export interface CampaignCharge {
  sends: number;
  includedSends: number;
  sendsRemaining: number;
  extraSends: number;
  addonFeeInr: number;
  extraSendChargeInr: number;
  totalInr: number;
}

/**
 * Charge for one month of the Campaigns add-on, in INR excluding GST and Meta's own message
 * charges. The ₹1,499 fee applies every month; extra sends cost ₹0.10 each above the quota.
 * Computed in paise so there is no floating-point drift. Not pro-rated for a first partial month.
 */
export function campaignCharge(sendsThisMonth: number): CampaignCharge {
  const sends = Number.isFinite(sendsThisMonth) && sendsThisMonth > 0 ? Math.floor(sendsThisMonth) : 0;
  const extraSends = Math.max(0, sends - CAMPAIGN_ADDON.includedSends);
  const extraSendChargePaise = extraSends * CAMPAIGN_ADDON.extraSendPaisePerSend;
  const addonFeePaise = CAMPAIGN_ADDON.monthlyPriceInr * 100;
  return {
    sends,
    includedSends: CAMPAIGN_ADDON.includedSends,
    sendsRemaining: Math.max(0, CAMPAIGN_ADDON.includedSends - sends),
    extraSends,
    addonFeeInr: CAMPAIGN_ADDON.monthlyPriceInr,
    extraSendChargeInr: extraSendChargePaise / 100,
    totalInr: (addonFeePaise + extraSendChargePaise) / 100,
  };
}

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

/**
 * Successful campaign sends in a workspace for a Kolkata calendar month, counted from the
 * recipient rows: accepted by Meta (sent, delivered or read). Keyed on attempted_at, the
 * moment the send was made, so later delivery receipts do not move a send to another month.
 */
export async function countCampaignSendsInMonth(workspaceId: string, monthKey: string): Promise<number> {
  const { start, end } = kolkataMonthBounds(monthKey);
  const rows = await database().query(
    `SELECT count(*)::int AS sends FROM app_campaign_recipients
     WHERE workspace_id = $1::uuid AND status IN ('sent', 'delivered', 'read')
       AND attempted_at >= $2::timestamptz AND attempted_at < $3::timestamptz`,
    [workspaceId, start.toISOString(), end.toISOString()]
  );
  return Number((rows[0] as { sends: number } | undefined)?.sends ?? 0);
}

/**
 * Adds `count` accepted sends to the workspace's durable monthly rollup for the Kolkata month
 * of `at`. Intended to be called by the sender after Meta accepts a message. The rollup
 * survives deletion of a campaign, whose recipient rows cascade away.
 */
export async function recordCampaignSends(workspaceId: string, count: number, at: Date): Promise<void> {
  if (!workspaceId) throw new Error("workspaceId is required");
  if (!Number.isInteger(count) || count < 0) throw new Error("count must be a non-negative integer");
  if (!(at instanceof Date) || Number.isNaN(at.getTime())) throw new Error("at must be a valid Date");
  if (count === 0) return;
  await database().query(
    `INSERT INTO app_campaign_usage_monthly (workspace_id, month, sends)
     VALUES ($1::uuid, $2, $3)
     ON CONFLICT (workspace_id, month) DO UPDATE SET
       sends = app_campaign_usage_monthly.sends + EXCLUDED.sends, updated_at = now()`,
    [workspaceId, kolkataMonthKey(at), count]
  );
}

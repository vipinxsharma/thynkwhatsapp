// Turns a stored WhatsApp connection into the read-only status a workspace sees on
// /partner-solutions. Pure functions only: no database or Meta calls here.

export type ConnectionStatus = "connected" | "restricted" | "disconnected";

export interface PartnerConnectionRow {
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  status: ConnectionStatus;
  webhookSubscribed: boolean;
  tokenExpiresAt: string | null;
  tokenCheckedAt: string | null;
  tokenRefreshError: string | null;
  connectedAt: string;
}

export type StatusTone = "ok" | "warn" | "action";

export interface PartnerStatus {
  tone: StatusTone;
  label: string;
  nextStep: string | null;
}

// Mirrors REFRESH_WINDOW_DAYS in lib/meta/token-refresh.ts: inside this window the
// daily job is already renewing the token, so the customer does not need to act.
export const RENEWAL_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export function describePartnerStatus(row: PartnerConnectionRow, now: Date = new Date()): PartnerStatus {
  if (row.status === "disconnected") {
    return { tone: "action", label: "Disconnected", nextStep: "Reconnect this number from Channels." };
  }
  if (row.status === "restricted") {
    return {
      tone: "action",
      label: "Restricted by Meta",
      nextStep: "Check this number's status in Meta Business Manager. Contact Xeccel support if it stays restricted.",
    };
  }
  if (row.tokenRefreshError) {
    return {
      tone: "action",
      label: "Access needs renewing",
      nextStep: "Reconnect this number from Channels so Xeccel can renew access.",
    };
  }
  if (row.tokenExpiresAt) {
    const expiresAt = new Date(row.tokenExpiresAt).getTime();
    if (Number.isNaN(expiresAt)) {
      return { tone: "warn", label: "Access expiry unknown", nextStep: "Xeccel will re-check access on its next run." };
    }
    if (expiresAt <= now.getTime()) {
      return { tone: "action", label: "Access expired", nextStep: "Reconnect this number from Channels." };
    }
    if (expiresAt - now.getTime() <= RENEWAL_WINDOW_DAYS * DAY_MS) {
      return { tone: "warn", label: "Renewal scheduled", nextStep: "Xeccel renews this automatically. No action needed." };
    }
  }
  if (!row.webhookSubscribed) {
    return {
      tone: "warn",
      label: "Message delivery not set up",
      nextStep: "Reconnect this number from Channels to restore incoming messages.",
    };
  }
  return { tone: "ok", label: "Connected", nextStep: null };
}

export function summarizeConnections(
  rows: PartnerConnectionRow[],
  now: Date = new Date()
): { total: number; needsAction: number; connected: number } {
  let needsAction = 0;
  let connected = 0;
  for (const row of rows) {
    const { tone } = describePartnerStatus(row, now);
    if (tone === "action") needsAction += 1;
    if (tone === "ok") connected += 1;
  }
  return { total: rows.length, needsAction, connected };
}

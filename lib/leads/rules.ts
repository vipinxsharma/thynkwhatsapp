// Pure lead rules: no database or network access, so they can be unit tested directly.

export type LeadSource = "interactive_button" | "template_button";

export type ButtonTap = {
  source: LeadSource;
  wamId: string;
  buttonText: string;
  buttonPayload: string;
  contextWamId: string | null;
  campaignRef: string | null;
  tappedAt: string; // ISO timestamp derived from the webhook's unix seconds
};

/** Subset of a Meta inbound message that lead capture reads. */
export type InboundMessageLike = {
  id: string;
  type: string;
  timestamp: string;
  context?: { id?: string };
  interactive?: { type?: string; button_reply?: { id?: string; title?: string } };
  button?: { text?: string; payload?: string };
};

export const DEFAULT_STAGE_NAME = "New";
export const MAX_STAGE_NAME_LENGTH = 60;

/**
 * Reads a button tap from an inbound message.
 * Covers interactive button replies and template quick-reply taps (`type: "button"`).
 * Returns null for any other message type or when the tap carries no text.
 */
export function buttonTapFromMessage(msg: InboundMessageLike): ButtonTap | null {
  let source: LeadSource;
  let buttonText: string;
  let buttonPayload: string;

  if (msg.type === "interactive" && msg.interactive?.type === "button_reply" && msg.interactive.button_reply) {
    source = "interactive_button";
    buttonText = msg.interactive.button_reply.title || "";
    buttonPayload = msg.interactive.button_reply.id || "";
  } else if (msg.type === "button" && msg.button) {
    source = "template_button";
    buttonText = msg.button.text || "";
    buttonPayload = msg.button.payload || "";
  } else {
    return null;
  }

  if (!buttonText && !buttonPayload) return null;

  const tappedSeconds = Number.parseInt(msg.timestamp, 10);
  const tappedAt = Number.isFinite(tappedSeconds)
    ? new Date(tappedSeconds * 1000).toISOString()
    : new Date().toISOString();

  return {
    source,
    wamId: msg.id,
    buttonText: buttonText.slice(0, 200),
    buttonPayload: buttonPayload.slice(0, 500),
    contextWamId: msg.context?.id || null,
    campaignRef: campaignRefFromPayload(buttonPayload),
    tappedAt,
  };
}

/**
 * A campaign reference is carried in the button payload as `campaign:<id>`.
 * The campaign-sending branch must set this prefix on its template buttons for attribution to work.
 */
export function campaignRefFromPayload(payload: string): string | null {
  const match = /^campaign:([A-Za-z0-9_-]{1,100})$/.exec(payload.trim());
  return match ? match[1] : null;
}

export function normalizeStageName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Stage name is required" };
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name || name.length > MAX_STAGE_NAME_LENGTH) {
    return { ok: false, error: `Stage name must be 1–${MAX_STAGE_NAME_LENGTH} characters` };
  }
  return { ok: true, name };
}

/** Accepts `YYYY-MM-DD` only and returns the same string when it is a real calendar date. */
export function parseDateOnly(raw: string | null): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return null;
  return raw;
}

/** Returns the exclusive upper bound for an inclusive `YYYY-MM-DD` end date. */
export function endOfDayExclusive(dateOnly: string): string {
  const next = new Date(`${dateOnly}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

/** Quotes a CSV cell when it contains a delimiter, quote or line break. */
export function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * For free text typed by contacts or staff (names, button titles, stage names).
 * A leading `=`, `+`, `-`, `@`, tab or carriage return is prefixed with an apostrophe so
 * spreadsheet apps do not evaluate it as a formula. Phone numbers stay unguarded, since they begin with `+`.
 */
export function csvText(value: string | null | undefined): string {
  const text = value ?? "";
  return csvCell(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text);
}

export const LEAD_CSV_HEADERS = [
  "Name",
  "Phone",
  "Stage",
  "Source",
  "Campaign",
  "Last button",
  "Taps",
  "First tap (UTC)",
  "Last tap (UTC)",
] as const;

export type LeadCsvRow = {
  name: string;
  phoneNumber: string;
  stageName: string;
  source: string;
  campaignRef: string | null;
  lastButtonText: string;
  tapCount: number;
  firstTappedAt: string;
  lastTappedAt: string;
};

export function leadsToCsv(rows: LeadCsvRow[]): string {
  const lines = [LEAD_CSV_HEADERS.map((header) => csvCell(header)).join(",")];
  for (const row of rows) {
    lines.push(
      [
        csvText(row.name),
        csvCell(row.phoneNumber),
        csvText(row.stageName),
        csvCell(row.source),
        csvText(row.campaignRef),
        csvText(row.lastButtonText),
        csvCell(row.tapCount),
        csvCell(row.firstTappedAt),
        csvCell(row.lastTappedAt),
      ].join(",")
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

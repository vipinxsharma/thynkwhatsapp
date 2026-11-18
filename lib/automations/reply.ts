import { createHash } from "node:crypto";

/**
 * Pure helpers for automated replies: placeholders, template variables, the reply
 * mode choice (24-hour window) and the loop guard. No I/O here.
 */

export const REPLY_PLACEHOLDERS = ["name", "phone"] as const;
export type ReplyPlaceholder = (typeof REPLY_PLACEHOLDERS)[number];

export const REPLY_TEXT_MAX = 1024;
export const TEMPLATE_VARIABLES_MAX = 10;
/** A bot reply repeated within this window is treated as an echo, never as a new trigger. */
export const BOT_ECHO_WINDOW_MS = 10 * 60 * 1000;
/** At most one automated reply per conversation within this window. */
export const BOT_REPLY_COOLDOWN_MS = 60 * 1000;

export class RuleValidationError extends Error {}

const placeholderPattern = /\{\{\s*([^{}]*?)\s*\}\}/g;

/** Rejects any {{...}} token that is not a supported placeholder, so typos never reach a customer. */
export function assertKnownPlaceholders(text: string, field: string): void {
  for (const match of text.matchAll(placeholderPattern)) {
    if (!(REPLY_PLACEHOLDERS as readonly string[]).includes(match[1])) {
      throw new RuleValidationError(`${field} uses an unknown placeholder {{${match[1]}}}. Use {{name}} or {{phone}}.`);
    }
  }
}

export function validateReplyText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new RuleValidationError("Reply text cannot be empty");
  if (value.length > REPLY_TEXT_MAX) throw new RuleValidationError(`Reply text must be ${REPLY_TEXT_MAX} characters or fewer`);
  assertKnownPlaceholders(value, "Reply text");
  return value.trim();
}

export function validateTemplateVariables(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > TEMPLATE_VARIABLES_MAX) {
    throw new RuleValidationError(`Template variables must be an array of up to ${TEMPLATE_VARIABLES_MAX} values`);
  }
  return value.map((item) => {
    if (typeof item !== "string" || item.length > 200) throw new RuleValidationError("Each template variable must be text of 200 characters or fewer");
    assertKnownPlaceholders(item, "Template variable");
    return item.trim();
  });
}

export interface PlaceholderValues {
  /** Contact name. Empty or unknown names render as "there". */
  name: string;
  /** Contact WhatsApp number in E.164 form, e.g. +919876543210. */
  phone: string;
}

/** Replaces {{name}} and {{phone}}. Unknown tokens are left as they are (validation rejects them earlier). */
export function renderPlaceholders(template: string, values: PlaceholderValues): string {
  const name = values.name.trim() || "there";
  return template.replace(placeholderPattern, (token, key: string) => {
    if (key === "name") return name;
    if (key === "phone") return values.phone;
    return token;
  });
}

/**
 * Meta rejects template parameters that contain newlines, tabs or long runs of spaces.
 * Values are flattened to one line and bounded before they are sent.
 */
export function sanitizeTemplateParameter(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, 1024) || " ";
}

export type ReplyMode =
  | { mode: "text"; text: string }
  | { mode: "template"; name: string; language: string; variables: string[] }
  | { mode: "skip"; reason: "window_closed" | "no_reply_configured" };

export interface ReplyCandidates {
  text: string | null;
  templateName: string | null;
  templateLanguage: string | null;
  templateVariables: string[];
}

/**
 * Inside the 24-hour customer care window a free-form text reply is used when one is set.
 * Outside it, only an approved template may be sent. Inside the window with only a template
 * configured, the template is used as well.
 */
export function chooseReplyMode(candidates: ReplyCandidates, windowOpen: boolean): ReplyMode {
  const hasTemplate = Boolean(candidates.templateName && candidates.templateLanguage);
  if (windowOpen && candidates.text) return { mode: "text", text: candidates.text };
  if (hasTemplate) {
    return {
      mode: "template",
      name: candidates.templateName as string,
      language: candidates.templateLanguage as string,
      variables: candidates.templateVariables,
    };
  }
  if (!windowOpen) return { mode: "skip", reason: "window_closed" };
  return { mode: "skip", reason: "no_reply_configured" };
}

/** Normalises text for comparing an inbound message with bot-authored text. */
export function normalizeForEcho(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
}

/**
 * Loop guard: an inbound message that repeats text the bot recently sent (an echo, a forwarded
 * copy or a client re-sending the reply) must not trigger rules again.
 */
export function isBotEcho(inboundText: string, recentBotTexts: string[]): boolean {
  const normalized = normalizeForEcho(inboundText);
  if (!normalized) return false;
  return recentBotTexts.some((sent) => normalizeForEcho(sent) === normalized);
}

/** A UUID derived from a seed, so a retried webhook produces the same outbound idempotency key. */
export function deterministicUuid(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex");
  const variant = "89ab"[parseInt(hex[16], 16) % 4];
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

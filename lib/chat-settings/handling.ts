import { RuleValidationError, validateReplyText } from "../automations/reply";

/** Pure rules for workspace chat settings. Storage lives in ./store.ts. */

export interface ChatSettings {
  unsubscribeKeyword: string | null;
  handoverKeyword: string | null;
  handoverMessage: string | null;
  holdingMessage: string | null;
}

export const emptyChatSettings: ChatSettings = {
  unsubscribeKeyword: null, handoverKeyword: null, handoverMessage: null, holdingMessage: null,
};

const keywordPattern = /^[^\n\r{}]{1,40}$/;

function optionalKeyword(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!keywordPattern.test(trimmed)) throw new RuleValidationError(`${label} must be 1–40 characters on one line`);
  return trimmed;
}

/** Same rules as the storage CHECKs, so invalid settings are rejected before a database call. */
export function parseChatSettings(value: unknown): ChatSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RuleValidationError("Chat settings are required");
  const v = value as Record<string, unknown>;
  const optionalMessage = (raw: unknown, label: string) => (raw === null || raw === undefined || raw === "")
    ? null : validateReplyTextLabelled(raw, label);
  const settings: ChatSettings = {
    unsubscribeKeyword: optionalKeyword(v.unsubscribeKeyword, "Unsubscribe keyword"),
    handoverKeyword: optionalKeyword(v.handoverKeyword, "Handover keyword"),
    handoverMessage: optionalMessage(v.handoverMessage, "Handover message"),
    holdingMessage: optionalMessage(v.holdingMessage, "Holding message"),
  };
  if (settings.unsubscribeKeyword && settings.handoverKeyword &&
      settings.unsubscribeKeyword.toLocaleLowerCase("en-US") === settings.handoverKeyword.toLocaleLowerCase("en-US")) {
    throw new RuleValidationError("The unsubscribe and handover keywords must be different");
  }
  return settings;
}

function validateReplyTextLabelled(raw: unknown, label: string): string {
  try {
    return validateReplyText(raw);
  } catch (error) {
    if (error instanceof RuleValidationError) throw new RuleValidationError(error.message.replace("Reply text", label));
    throw error;
  }
}

export function parseBlockedNumber(value: unknown): string {
  if (typeof value !== "string") throw new RuleValidationError("Enter a phone number");
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) throw new RuleValidationError("Enter the full number with country code");
  return digits;
}

/** Exact, case-insensitive match of the whole message, so ordinary sentences never trigger handling. */
export function messageIsKeyword(text: string, keyword: string | null): boolean {
  if (!keyword) return false;
  return text.trim().toLocaleLowerCase("en-US") === keyword.trim().toLocaleLowerCase("en-US");
}

export type InboundDecision =
  | { kind: "blocked" }
  | { kind: "unsubscribe" }
  | { kind: "handover" }
  | { kind: "route" };

/**
 * Order matters. A blocked sender is stored but never answered, so nothing else runs.
 * Unsubscribe comes before handover so a stop request is never treated as a hand-over.
 */
export function decideInbound(input: {
  blocked: boolean;
  text: string | null;
  settings: ChatSettings;
}): InboundDecision {
  if (input.blocked) return { kind: "blocked" };
  if (input.text === null) return { kind: "route" };
  if (messageIsKeyword(input.text, input.settings.unsubscribeKeyword)) return { kind: "unsubscribe" };
  if (messageIsKeyword(input.text, input.settings.handoverKeyword)) return { kind: "handover" };
  return { kind: "route" };
}

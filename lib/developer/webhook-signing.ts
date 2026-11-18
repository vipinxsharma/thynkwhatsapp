import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Pure helpers for outbound webhooks: event names, signing, retry timing and URL checks.

export const WEBHOOK_EVENT_TYPES = ["message.received", "message.status_changed", "contact.created"] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const WEBHOOK_SIGNATURE_HEADER = "X-Xeccel-Signature";
export const WEBHOOK_EVENT_HEADER = "X-Xeccel-Event";
export const WEBHOOK_EVENT_ID_HEADER = "X-Xeccel-Event-Id";
export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

/** Total delivery attempts per event: the first send plus five retries. */
export const MAX_WEBHOOK_ATTEMPTS = 6;
const RETRY_DELAYS_MS = [30_000, 2 * 60_000, 10 * 60_000, 60 * 60_000, 6 * 60 * 60_000];

/** Delay before the next attempt, given how many attempts have already been made (1-based). */
export function webhookRetryDelayMs(attemptsMade: number): number {
  const index = Math.min(Math.max(attemptsMade, 1) - 1, RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[index];
}

export function generateSigningSecret(random: (size: number) => Buffer = randomBytes): string {
  return `whsec_${random(32).toString("base64url")}`;
}

function macFor(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex");
}

/** Builds the `X-Xeccel-Signature` header value: `t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">`. */
export function signWebhookPayload(input: { secret: string; body: string; timestampSeconds: number }): string {
  return `t=${input.timestampSeconds},v1=${macFor(input.secret, input.timestampSeconds, input.body)}`;
}

function parseSignatureHeader(header: string): { timestamp: number; signatures: string[] } | null {
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (key === "t" && /^\d+$/.test(value || "")) timestamp = Number(value);
    if (key === "v1" && /^[0-9a-f]{64}$/i.test(value || "")) signatures.push(value.toLowerCase());
  }
  return timestamp === null || signatures.length === 0 ? null : { timestamp, signatures };
}

/**
 * Checks a received signature. Rejects bad MACs and timestamps outside the tolerance window,
 * which limits replay of captured requests.
 */
export function verifyWebhookSignature(input: {
  secret: string;
  body: string;
  header: string | null | undefined;
  nowSeconds: number;
  toleranceSeconds?: number;
}): boolean {
  if (!input.header) return false;
  const parsed = parseSignatureHeader(input.header);
  if (!parsed) return false;
  const tolerance = input.toleranceSeconds ?? WEBHOOK_SIGNATURE_TOLERANCE_SECONDS;
  if (Math.abs(input.nowSeconds - parsed.timestamp) > tolerance) return false;
  const expected = Buffer.from(macFor(input.secret, parsed.timestamp, input.body), "hex");
  return parsed.signatures.some((signature) => {
    const candidate = Buffer.from(signature, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}

export function validateWebhookEvents(events: unknown): { ok: true; events: WebhookEventType[] } | { ok: false; error: string } {
  if (!Array.isArray(events) || events.length === 0) {
    return { ok: false, error: "Choose at least one event" };
  }
  const unique = Array.from(new Set(events));
  const unknown = unique.filter((event) => !(WEBHOOK_EVENT_TYPES as readonly string[]).includes(String(event)));
  if (unknown.length > 0) return { ok: false, error: `Unknown events: ${unknown.join(", ")}` };
  return { ok: true, events: unique as WebhookEventType[] };
}

// Matches literal private or loopback hosts only. Ordinary names such as fdic.gov are not affected.
const PRIVATE_IPV4 = /^(0\.0\.0\.0|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;
const PRIVATE_IPV6 = /^\[(::1|f[cd][0-9a-f]{0,2}:.*|fe80:.*)\]$/i;

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.startsWith("[")) return PRIVATE_IPV6.test(host);
  return PRIVATE_IPV4.test(host);
}

/**
 * Accepts only https URLs without credentials that do not point at obvious private hosts.
 * This is a literal check. It does not resolve DNS, so a public name that resolves to a private
 * address is not caught here.
 */
export function validateWebhookUrl(
  raw: unknown,
  options: { allowLocalHttp: boolean },
): { ok: true; url: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || raw.trim().length === 0 || raw.length > 2048) {
    return { ok: false, error: "Enter an endpoint URL of up to 2048 characters" };
  }
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, error: "Endpoint URL is not valid" };
  }
  if (parsed.username || parsed.password) return { ok: false, error: "Endpoint URL must not contain credentials" };
  const local = isPrivateHost(parsed.hostname);
  if (parsed.protocol === "https:") {
    if (local && !options.allowLocalHttp) return { ok: false, error: "Endpoint URL must be a public host" };
    return { ok: true, url: parsed.toString() };
  }
  if (parsed.protocol === "http:" && options.allowLocalHttp && local) {
    return { ok: true, url: parsed.toString() };
  }
  return { ok: false, error: "Endpoint URL must use https" };
}

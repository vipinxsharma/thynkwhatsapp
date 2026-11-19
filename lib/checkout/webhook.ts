import crypto from "node:crypto";

// Signature check is shared with subscription billing: base64(HMAC-SHA256(secret, timestamp + rawBody)).
export { verifyCashfreeSignature } from "@/lib/billing/webhook";

export type CheckoutEventKind = "payment_success" | "payment_failed" | "link_status" | "ignored";

export interface CheckoutWebhookEvent {
  eventType: string;
  kind: CheckoutEventKind;
  linkId: string | null;
  providerStatus: string;
  paymentRef: string | null;
  // Stable across redeliveries of the same event, so the events table can deduplicate.
  eventKey: string;
  payload: Record<string, unknown>;
}

type Parsed = { ok: true; event: CheckoutWebhookEvent } | { ok: false; error: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

// Cashfree sends some ids as numbers (e.g. cf_payment_id); keep them as strings.
function idString(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : str(value);
}

function classify(eventType: string): CheckoutEventKind {
  switch (eventType) {
    case "PAYMENT_SUCCESS_WEBHOOK":
      return "payment_success";
    case "PAYMENT_FAILED_WEBHOOK":
      return "payment_failed";
    case "PAYMENT_LINK_EVENT":
      return "link_status";
    default:
      return "ignored";
  }
}

/** Parses a verified Cashfree body. Call only after the signature has been checked against the raw body. */
export function parseCheckoutWebhook(rawBody: string): Parsed {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { ok: false, error: "Invalid payload" };
  }
  const root = asRecord(parsed);
  if (!root) return { ok: false, error: "Invalid payload" };

  const eventType = str(root.type) ?? "";
  const data = asRecord(root.data) ?? {};
  const link = asRecord(data.link);
  const order = asRecord(data.order);
  const payment = asRecord(data.payment);

  const linkId = str(data.link_id) ?? str(link?.link_id);
  const providerStatus = str(payment?.payment_status) ?? str(data.link_status) ?? str(link?.link_status) ?? "";
  const paymentRef = idString(payment?.cf_payment_id) ?? idString(order?.cf_order_id);
  const kind = classify(eventType);

  // Derived from fields that do not change on redelivery, so a retried webhook produces the same key.
  const eventKey = crypto
    .createHash("sha256")
    .update([eventType, linkId ?? "", paymentRef ?? "", providerStatus].join("|"))
    .digest("hex");

  return {
    ok: true,
    event: { eventType, kind, linkId, providerStatus, paymentRef, eventKey, payload: root },
  };
}

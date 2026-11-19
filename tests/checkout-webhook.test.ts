import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseCheckoutWebhook, verifyCashfreeSignature } from "../lib/checkout/webhook";

const secret = "test-secret";
const timestamp = "1763500000";

function signed(body: string) {
  return crypto.createHmac("sha256", secret).update(timestamp + body).digest("base64");
}

describe("checkout webhook signature", () => {
  const body = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: { link_id: "co_1" } });

  it("accepts a body signed over timestamp and raw body", () => {
    expect(verifyCashfreeSignature({ rawBody: body, timestamp, signature: signed(body), secret })).toBe(true);
  });

  it("rejects a changed body, a changed timestamp or a missing header", () => {
    const signature = signed(body);
    expect(verifyCashfreeSignature({ rawBody: body + " ", timestamp, signature, secret })).toBe(false);
    expect(verifyCashfreeSignature({ rawBody: body, timestamp: "1", signature, secret })).toBe(false);
    expect(verifyCashfreeSignature({ rawBody: body, timestamp, signature: null, secret })).toBe(false);
  });
});

describe("parseCheckoutWebhook", () => {
  it("reads a successful payment on a link", () => {
    const body = JSON.stringify({
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: { link: { link_id: "co_abc" }, payment: { cf_payment_id: 987, payment_status: "SUCCESS" } },
    });
    const parsed = parseCheckoutWebhook(body);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.event).toMatchObject({
      kind: "payment_success",
      linkId: "co_abc",
      providerStatus: "SUCCESS",
      paymentRef: "987",
    });
  });

  it("produces the same key when the same event is redelivered", () => {
    const event = { type: "PAYMENT_FAILED_WEBHOOK", data: { link_id: "co_x", payment: { cf_payment_id: "p1", payment_status: "FAILED" } } };
    const a = parseCheckoutWebhook(JSON.stringify(event));
    const b = parseCheckoutWebhook(JSON.stringify({ ...event, attempt: 2 }));
    expect(a.ok && b.ok && a.event.eventKey === b.event.eventKey).toBe(true);
  });

  it("gives different keys to different payment attempts on the same link", () => {
    const first = parseCheckoutWebhook(JSON.stringify({ type: "PAYMENT_FAILED_WEBHOOK", data: { link_id: "co_x", payment: { cf_payment_id: "p1", payment_status: "FAILED" } } }));
    const second = parseCheckoutWebhook(JSON.stringify({ type: "PAYMENT_FAILED_WEBHOOK", data: { link_id: "co_x", payment: { cf_payment_id: "p2", payment_status: "FAILED" } } }));
    expect(first.ok && second.ok && first.event.eventKey !== second.event.eventKey).toBe(true);
  });

  it("classifies link status events and ignores unknown types", () => {
    const link = parseCheckoutWebhook(JSON.stringify({ type: "PAYMENT_LINK_EVENT", data: { link_id: "co_1", link_status: "EXPIRED" } }));
    expect(link.ok && link.event.kind).toBe("link_status");
    expect(link.ok && link.event.providerStatus).toBe("EXPIRED");
    const other = parseCheckoutWebhook(JSON.stringify({ type: "PAYMENT_USER_DROPPED_WEBHOOK", data: { link_id: "co_1" } }));
    expect(other.ok && other.event.kind).toBe("ignored");
  });

  it("rejects bodies that are not JSON objects", () => {
    expect(parseCheckoutWebhook("not json").ok).toBe(false);
    expect(parseCheckoutWebhook("[1,2]").ok).toBe(false);
    expect(parseCheckoutWebhook("null").ok).toBe(false);
  });
});

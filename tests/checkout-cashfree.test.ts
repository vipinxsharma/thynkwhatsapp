import { describe, expect, it, vi } from "vitest";
import { createCashfreePaymentLink, fetchCashfreePaymentLink, paiseToRupeesString } from "../lib/checkout/cashfree-links";

const creds = { clientId: "id", clientSecret: "secret", env: "sandbox" as const };
const input = {
  linkId: "co_0123456789abcdef0123456789abcdef",
  amountPaise: 49950,
  description: "Blue kurta",
  customerName: "Asha",
  customerPhone: "9876543210",
  expiresAt: new Date("2026-11-21T10:00:00Z"),
  notifyUrl: "https://app.example/api/checkout/webhook",
  returnUrl: null,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("cashfree payment links", () => {
  it("formats paise as rupees with two decimals", () => {
    expect(paiseToRupeesString(49950)).toBe("499.50");
    expect(paiseToRupeesString(100)).toBe("1.00");
  });

  it("sends the link to the sandbox /links endpoint with our id, amount and expiry", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { link_id: input.linkId, link_url: "https://sandbox.cashfree.com/pay/abc" }));
    const issued = await createCashfreePaymentLink(creds, input, fetchImpl);

    expect(issued).toEqual({ linkId: input.linkId, linkUrl: "https://sandbox.cashfree.com/pay/abc" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://sandbox.cashfree.com/pg/links");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-client-id"]).toBe("id");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      link_id: input.linkId,
      link_amount: 499.5,
      link_currency: "INR",
      link_expiry_time: "2026-11-21T10:00:00.000Z",
      link_notify: { send_sms: false, send_email: false },
      link_meta: { notify_url: input.notifyUrl },
    });
    expect(body.link_meta.return_url).toBeUndefined();
  });

  it("uses the production host only when configured", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { link_url: "https://pay.example" }));
    await createCashfreePaymentLink({ ...creds, env: "production" }, input, fetchImpl);
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe("https://api.cashfree.com/pg/links");
  });

  it("throws when Cashfree rejects the link, without leaking the secret", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(400, { message: "link_amount invalid" }));
    await expect(createCashfreePaymentLink(creds, input, fetchImpl)).rejects.toThrow("link_amount invalid");
  });

  it("reads link status and paid amount, converting rupees to paise", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { link_status: "PAID", link_amount_paid: 499.5 }));
    await expect(fetchCashfreePaymentLink(creds, input.linkId, fetchImpl)).resolves.toEqual({ linkStatus: "PAID", amountPaidPaise: 49950 });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(`https://sandbox.cashfree.com/pg/links/${input.linkId}`);
  });

  it("returns null when the status lookup fails", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(500, {}));
    await expect(fetchCashfreePaymentLink(creds, input.linkId, fetchImpl)).resolves.toBeNull();
  });
});

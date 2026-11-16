import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { billingConfig } from "../lib/billing/config";
import { quoteMonthly } from "../lib/billing/quote";
import { verifyCashfreeSignature } from "../lib/billing/webhook";

describe("billingConfig", () => {
  it("defaults to ₹699 per number in paise, sandbox, monthly", () => {
    expect(billingConfig({})).toEqual({
      currency: "INR", pricePerNumberPaise: 69900, interval: "monthly", cashfreeEnv: "sandbox",
    });
  });
  it("reads price and environment from env", () => {
    const c = billingConfig({ BILLING_PRICE_PER_NUMBER_PAISE: "100000", CASHFREE_ENV: "production" });
    expect(c.pricePerNumberPaise).toBe(100000);
    expect(c.cashfreeEnv).toBe("production");
  });
  it("rejects a non-integer price", () => {
    expect(() => billingConfig({ BILLING_PRICE_PER_NUMBER_PAISE: "699.5" })).toThrow();
  });
});

describe("quoteMonthly", () => {
  const cfg = billingConfig({});
  it("charges ₹699 per active number", () => {
    expect(quoteMonthly(3, cfg)).toEqual({ billableNumbers: 3, amountPaise: 209700, currency: "INR", interval: "monthly" });
  });
  it("is zero with no numbers", () => {
    expect(quoteMonthly(0, cfg).amountPaise).toBe(0);
  });
  it("rejects invalid counts", () => {
    expect(() => quoteMonthly(-1, cfg)).toThrow();
    expect(() => quoteMonthly(1.5, cfg)).toThrow();
  });
});

describe("verifyCashfreeSignature", () => {
  const secret = "test-secret";
  const body = '{"type":"PAYMENT_SUCCESS","data":{"amount":699}}';
  const ts = "1794836819296";
  const sig = crypto.createHmac("sha256", secret).update(ts + body).digest("base64");

  it("accepts a correct signature over timestamp + raw body", () => {
    expect(verifyCashfreeSignature({ rawBody: body, timestamp: ts, signature: sig, secret })).toBe(true);
  });
  it("rejects a tampered body", () => {
    expect(verifyCashfreeSignature({ rawBody: body.replace("699", "1"), timestamp: ts, signature: sig, secret })).toBe(false);
  });
  it("rejects missing headers or secret", () => {
    expect(verifyCashfreeSignature({ rawBody: body, timestamp: null, signature: sig, secret })).toBe(false);
    expect(verifyCashfreeSignature({ rawBody: body, timestamp: ts, signature: null, secret })).toBe(false);
    expect(verifyCashfreeSignature({ rawBody: body, timestamp: ts, signature: sig, secret: "" })).toBe(false);
  });
});

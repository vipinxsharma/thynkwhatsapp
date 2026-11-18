import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { billingPlans, findBillingPlan, isValidIndianMobile, planAmountPaise, planPeriodEnd } from "../lib/billing/plans";
import { verifyCashfreeSignature } from "../lib/billing/webhook";
import { cashfreeCredentials } from "../lib/billing/cashfree";

describe("billing plans", () => {
  it("resolves only known plan ids", () => {
    expect(findBillingPlan("whats-crm-monthly")?.priceInr).toBe(2000);
    expect(findBillingPlan("made-up")).toBeUndefined();
    expect(findBillingPlan(undefined)).toBeUndefined();
  });

  it("charges the listed price in paise", () => {
    const plan = findBillingPlan("sales-accelerator")!;
    expect(planAmountPaise(plan)).toBe(2_000_000);
  });

  it("gives yearly plans 12 months and monthly plans 30 days", () => {
    const start = new Date("2026-11-19T00:00:00Z");
    expect(planPeriodEnd(findBillingPlan("sales-accelerator")!, start).toISOString()).toBe("2027-11-19T00:00:00.000Z");
    expect(planPeriodEnd(findBillingPlan("whats-crm-monthly")!, start).toISOString()).toBe("2026-12-19T00:00:00.000Z");
  });

  it("keeps every catalogue id URL-safe for the plan check", () => {
    for (const plan of billingPlans) expect(plan.id).toMatch(/^[a-z0-9][a-z0-9_-]{0,63}$/);
  });

  it("accepts only 10-digit Indian mobile numbers", () => {
    expect(isValidIndianMobile("9876543210")).toBe(true);
    expect(isValidIndianMobile("5876543210")).toBe(false);
    expect(isValidIndianMobile("987654321")).toBe(false);
    expect(isValidIndianMobile(9876543210)).toBe(false);
  });
});

describe("cashfree webhook signature", () => {
  const secret = "test-secret";
  const rawBody = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: { order: { order_id: "xc_1" } } });
  const timestamp = "1763500000";
  const signature = crypto.createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");

  it("accepts a correctly signed body", () => {
    expect(verifyCashfreeSignature({ rawBody, timestamp, signature, secret })).toBe(true);
  });

  it("rejects a tampered body, wrong secret or missing headers", () => {
    expect(verifyCashfreeSignature({ rawBody: rawBody + " ", timestamp, signature, secret })).toBe(false);
    expect(verifyCashfreeSignature({ rawBody, timestamp, signature, secret: "other" })).toBe(false);
    expect(verifyCashfreeSignature({ rawBody, timestamp: null, signature, secret })).toBe(false);
    expect(verifyCashfreeSignature({ rawBody, timestamp, signature: null, secret })).toBe(false);
  });
});

describe("cashfree credentials", () => {
  it("is disabled without keys and defaults to sandbox", () => {
    expect(cashfreeCredentials({})).toBeNull();
    expect(cashfreeCredentials({ CASHFREE_CLIENT_ID: "id", CASHFREE_CLIENT_SECRET: "s" })?.env).toBe("sandbox");
    expect(cashfreeCredentials({ CASHFREE_CLIENT_ID: "id", CASHFREE_CLIENT_SECRET: "s", CASHFREE_ENV: "production" })?.env).toBe("production");
  });
});

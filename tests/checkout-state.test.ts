import { describe, expect, it } from "vitest";
import { canIssuePaymentLink, canTransition, parseOrderInput, statusesThatCanEnter } from "../lib/checkout/state";

describe("checkout order transitions", () => {
  it("only lets a paid order stay paid", () => {
    expect(canTransition("paid", "paid")).toBe(true);
    for (const to of ["created", "link_sent", "failed", "expired"] as const) {
      expect(canTransition("paid", to)).toBe(false);
    }
    expect(statusesThatCanEnter("paid")).not.toContain("paid");
    expect(statusesThatCanEnter("paid")).toEqual(["created", "link_sent", "failed", "expired"]);
  });

  it("moves forward through link_sent to paid, failed or expired", () => {
    expect(canTransition("created", "link_sent")).toBe(true);
    expect(canTransition("link_sent", "paid")).toBe(true);
    expect(canTransition("link_sent", "failed")).toBe(true);
    expect(canTransition("link_sent", "expired")).toBe(true);
  });

  it("never goes back to created", () => {
    for (const from of ["link_sent", "paid", "failed", "expired"] as const) {
      expect(canTransition(from, "created")).toBe(false);
    }
  });

  it("lets a failed or expired order get a new link, but not a link_sent order", () => {
    expect(canTransition("failed", "link_sent")).toBe(true);
    expect(canTransition("expired", "link_sent")).toBe(true);
    expect(statusesThatCanEnter("link_sent")).not.toContain("link_sent");
  });
});

describe("payment link issuing", () => {
  const now = new Date("2026-11-19T10:00:00Z");
  const later = new Date("2026-11-19T12:00:00Z");

  it("refuses a paid order and a link that is still live", () => {
    expect(canIssuePaymentLink({ status: "paid", linkExpiresAt: null }, now)).toBe(false);
    expect(canIssuePaymentLink({ status: "link_sent", linkExpiresAt: later }, now)).toBe(false);
  });

  it("allows a new link once the previous one has expired by our clock", () => {
    expect(canIssuePaymentLink({ status: "link_sent", linkExpiresAt: now }, now)).toBe(true);
    expect(canIssuePaymentLink({ status: "created", linkExpiresAt: null }, now)).toBe(true);
    expect(canIssuePaymentLink({ status: "failed", linkExpiresAt: later }, now)).toBe(true);
  });
});

describe("order input", () => {
  it("stores rupees as paise and trims the description", () => {
    expect(parseOrderInput({ amountInr: 499.5, description: "  Blue kurta  " })).toEqual({
      ok: true,
      amountPaise: 49950,
      description: "Blue kurta",
    });
  });

  it("rejects amounts outside Rs 1 to Rs 5,00,000 or with fractions of a paisa", () => {
    expect(parseOrderInput({ amountInr: 0.5, description: "x" }).ok).toBe(false);
    expect(parseOrderInput({ amountInr: 500001, description: "x" }).ok).toBe(false);
    expect(parseOrderInput({ amountInr: 10.123, description: "x" }).ok).toBe(false);
    expect(parseOrderInput({ amountInr: "100", description: "x" }).ok).toBe(false);
    expect(parseOrderInput({ amountInr: NaN, description: "x" }).ok).toBe(false);
  });

  it("requires a description of 1 to 200 characters", () => {
    expect(parseOrderInput({ amountInr: 100, description: "   " }).ok).toBe(false);
    expect(parseOrderInput({ amountInr: 100, description: "a".repeat(201) }).ok).toBe(false);
    expect(parseOrderInput({ amountInr: 100, description: 42 }).ok).toBe(false);
  });
});

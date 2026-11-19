import { describe, expect, it } from "vitest";
import { campaignAddon, campaignExtraCharge } from "../lib/billing/addons";

describe("campaign add-on", () => {
  it("matches the agreed price and quota", () => {
    expect(campaignAddon.monthlyPriceInr).toBe(1499);
    expect(campaignAddon.includedSends).toBe(10000);
    expect(campaignAddon.extraSendPriceInr).toBe(0.1);
  });

  it("charges nothing up to the included sends", () => {
    expect(campaignExtraCharge(0)).toBe(0);
    expect(campaignExtraCharge(10000)).toBe(0);
  });

  it("charges ₹0.10 per send above the quota", () => {
    expect(campaignExtraCharge(10500)).toBe(50);
    expect(campaignExtraCharge(12345)).toBe(234.5);
  });
});

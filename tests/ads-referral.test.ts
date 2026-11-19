import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordButtonTap: vi.fn(),
  recordAdAttribution: vi.fn(),
}));

vi.mock("../lib/leads/store", () => ({ recordButtonTap: mocks.recordButtonTap }));
vi.mock("../lib/ads/attribution-store", () => ({ recordAdAttribution: mocks.recordAdAttribution }));

import { adReferralFromInbound } from "../lib/ads/referral";
import { captureLeadFromInbound } from "../lib/leads/capture";

const adReferral = {
  source_url: "https://fb.me/abc123",
  source_type: "ad",
  source_id: "120210000000001",
  headline: "Spring sale",
  body: "Tap to chat about the offer",
  media_type: "image",
  ctwa_clid: "ARAkLTg1234",
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.recordButtonTap.mockResolvedValue(true);
  mocks.recordAdAttribution.mockResolvedValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("adReferralFromInbound", () => {
  it("reads an ad referral with every field", () => {
    expect(adReferralFromInbound(adReferral)).toEqual({
      sourceType: "ad",
      sourceId: "120210000000001",
      sourceUrl: "https://fb.me/abc123",
      headline: "Spring sale",
      body: "Tap to chat about the offer",
      mediaType: "image",
      ctwaClid: "ARAkLTg1234",
    });
  });

  it("reads a post referral and accepts a numeric source id", () => {
    const result = adReferralFromInbound({ source_type: "post", source_id: 987654321 });
    expect(result).toMatchObject({ sourceType: "post", sourceId: "987654321", ctwaClid: null, sourceUrl: null });
  });

  it("returns null when there is no referral", () => {
    expect(adReferralFromInbound(undefined)).toBeNull();
    expect(adReferralFromInbound(null)).toBeNull();
  });

  it("drops a referral with an unknown source type or a missing source id", () => {
    expect(adReferralFromInbound({ ...adReferral, source_type: "story" })).toBeNull();
    expect(adReferralFromInbound({ ...adReferral, source_id: "" })).toBeNull();
    expect(adReferralFromInbound({ ...adReferral, source_id: "../../etc" })).toBeNull();
    expect(adReferralFromInbound({ ...adReferral, source_id: undefined })).toBeNull();
  });

  it("keeps only https source URLs", () => {
    expect(adReferralFromInbound({ ...adReferral, source_url: "javascript:alert(1)" })?.sourceUrl).toBeNull();
    expect(adReferralFromInbound({ ...adReferral, source_url: "http://example.com/ad" })?.sourceUrl).toBeNull();
  });

  it("caps free text and treats an empty click id as absent", () => {
    const result = adReferralFromInbound({
      ...adReferral,
      headline: "h".repeat(500),
      body: "b".repeat(5000),
      ctwa_clid: "   ",
    });
    expect(result?.headline).toHaveLength(300);
    expect(result?.body).toHaveLength(1000);
    expect(result?.ctwaClid).toBeNull();
  });
});

describe("captureLeadFromInbound with referrals", () => {
  const timestamp = "1763510400";

  it("records attribution for a referral with no button tap", async () => {
    await captureLeadFromInbound("ws-1", "contact-1", {
      id: "wamid.ad1",
      type: "text",
      timestamp,
      referral: adReferral,
    });

    expect(mocks.recordButtonTap).not.toHaveBeenCalled();
    expect(mocks.recordAdAttribution).toHaveBeenCalledWith(
      "ws-1",
      "contact-1",
      "wamid.ad1",
      new Date(Number(timestamp) * 1000).toISOString(),
      expect.objectContaining({ sourceType: "ad", sourceId: "120210000000001" }),
    );
  });

  it("records both the button tap and the referral when a referred message is a button tap", async () => {
    await captureLeadFromInbound("ws-1", "contact-1", {
      id: "wamid.ad2",
      type: "interactive",
      timestamp,
      interactive: { type: "button_reply", button_reply: { id: "buy", title: "Buy now" } },
      referral: adReferral,
    });

    expect(mocks.recordButtonTap).toHaveBeenCalledTimes(1);
    expect(mocks.recordAdAttribution).toHaveBeenCalledTimes(1);
  });

  it("does not write attribution for a message without a referral", async () => {
    await captureLeadFromInbound("ws-1", "contact-1", { id: "wamid.plain", type: "text", timestamp });
    expect(mocks.recordAdAttribution).not.toHaveBeenCalled();
  });

  it("does not write attribution when the referral has no usable source", async () => {
    await captureLeadFromInbound("ws-1", "contact-1", {
      id: "wamid.bad",
      type: "text",
      timestamp,
      referral: { ...adReferral, source_type: "unknown" },
    });
    expect(mocks.recordAdAttribution).not.toHaveBeenCalled();
  });

  it("swallows a storage failure so the webhook is not failed", async () => {
    mocks.recordAdAttribution.mockRejectedValueOnce(new Error("db down"));
    await expect(
      captureLeadFromInbound("ws-1", "contact-1", { id: "wamid.x", type: "text", timestamp, referral: adReferral }),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

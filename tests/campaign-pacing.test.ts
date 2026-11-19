import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  batchClaimLimit, campaignLevelPauseReason, DAILY_SEND_CAP, minimumSendGapMs, msUntilNextSend,
  qualityPauseReason, remainingDailyBudget, SENDS_PER_SECOND,
} from "@/lib/campaigns/pacing";

describe("per-second pacing", () => {
  it("uses 20 sends per second by default, a 50 ms gap", () => {
    expect(SENDS_PER_SECOND).toBe(20);
    expect(minimumSendGapMs()).toBe(50);
    expect(minimumSendGapMs(10)).toBe(100);
  });

  it("allows an immediate send when nothing was sent yet", () => {
    expect(msUntilNextSend(null, 1_000)).toBe(0);
  });

  it("waits for the rest of the gap after the last send", () => {
    expect(msUntilNextSend(1_000, 1_020)).toBe(30);
    expect(msUntilNextSend(1_000, 1_050)).toBe(0);
    expect(msUntilNextSend(1_000, 9_000)).toBe(0);
  });

  it("rejects a non-positive rate", () => {
    expect(() => minimumSendGapMs(0)).toThrow();
  });
});

describe("rolling daily cap", () => {
  it("has a conservative default of 250 per 24 hours", () => {
    expect(DAILY_SEND_CAP).toBe(250);
  });

  it("returns what is left of the cap and never a negative number", () => {
    expect(remainingDailyBudget(0)).toBe(250);
    expect(remainingDailyBudget(249)).toBe(1);
    expect(remainingDailyBudget(250)).toBe(0);
    expect(remainingDailyBudget(400)).toBe(0);
  });

  it("limits a batch claim to the remaining budget", () => {
    expect(batchClaimLimit(40, 1000)).toBe(40);
    expect(batchClaimLimit(40, 12)).toBe(12);
    expect(batchClaimLimit(40, 0)).toBe(0);
  });
});

describe("quality auto-pause", () => {
  it("pauses on YELLOW and RED", () => {
    expect(qualityPauseReason("YELLOW", "123")).toMatch(/YELLOW quality rating/);
    expect(qualityPauseReason("RED", "123")).toMatch(/RED quality rating/);
    expect(qualityPauseReason(" red ", "123")).toMatch(/RED quality rating/);
  });

  it("does not pause on GREEN, an unknown rating, or no recorded rating", () => {
    expect(qualityPauseReason("GREEN", "123")).toBeNull();
    expect(qualityPauseReason("UNKNOWN", "123")).toBeNull();
    expect(qualityPauseReason(null, "123")).toBeNull();
    expect(qualityPauseReason("", "123")).toBeNull();
  });

  it("names the number so the reason is clear", () => {
    expect(qualityPauseReason("RED", "15551234567")).toContain("15551234567");
  });
});

describe("Meta campaign-level errors", () => {
  it("pauses on throughput and rate limits", () => {
    expect(campaignLevelPauseReason({ message: "rate", httpStatus: 400, code: 130429 })).toBe("Sending paused: rate");
    expect(campaignLevelPauseReason({ message: "rate", httpStatus: 400, code: 80007 })).not.toBeNull();
    expect(campaignLevelPauseReason({ message: "rate", httpStatus: 400, code: 131056 })).not.toBeNull();
  });

  it("pauses on an HTTP 429 even without a Meta code", () => {
    expect(campaignLevelPauseReason({ message: "slow down", httpStatus: 429, code: null })).not.toBeNull();
  });

  it("pauses on the ecosystem-health block (131049)", () => {
    expect(campaignLevelPauseReason({ message: "healthy", httpStatus: 400, code: 131049 })).not.toBeNull();
  });

  it("does not pause on a recipient-specific failure", () => {
    expect(campaignLevelPauseReason({ message: "bad number", httpStatus: 400, code: 131026 })).toBeNull();
    expect(campaignLevelPauseReason({ message: "bad", httpStatus: 400, code: null })).toBeNull();
  });
});

// ---------------------------------------------------------------- sender behaviour

const mocks = vi.hoisted(() => ({
  expireStuck: vi.fn(), getCampaign: vi.fn(), transition: vi.fn(), connection: vi.fn(),
  quality: vi.fn(), countWindow: vi.fn(), claim: vi.fn(), optedIn: vi.fn(), settle: vi.fn(),
  logAttempt: vi.fn(), complete: vi.fn(), sendMessage: vi.fn(), conversation: vi.fn(),
  recordMessage: vi.fn(),
}));

vi.mock("@/lib/campaigns/store", () => ({
  expireStuckRecipients: mocks.expireStuck,
  getCampaign: mocks.getCampaign,
  transitionCampaign: mocks.transition,
  getChannelQualityRating: mocks.quality,
  countNumberSendsInWindow: mocks.countWindow,
  claimRecipients: mocks.claim,
  optedInContactIds: mocks.optedIn,
  settleRecipient: mocks.settle,
  recordSendAttempt: mocks.logAttempt,
  completeCampaignIfDone: mocks.complete,
  findConversationId: mocks.conversation,
}));
vi.mock("@/lib/meta/connections", () => ({ getMetaConnectionForNumber: mocks.connection }));
vi.mock("@/lib/meta/client", async () => {
  class MetaSendError extends Error {
    constructor(message: string, public readonly httpStatus: number, public readonly code: number | null) {
      super(message);
      this.name = "MetaSendError";
    }
  }
  return {
    MetaSendError,
    MetaGraphClient: class { sendMessage = mocks.sendMessage; },
  };
});
vi.mock("@/lib/inbox/store", () => ({ recordMessage: mocks.recordMessage }));

import { sendCampaignBatch } from "@/lib/campaigns/sender";
import { MetaSendError } from "@/lib/meta/client";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const campaignId = "22222222-2222-4222-8222-222222222222";
const phoneNumberId = "123456789012345";

function recipients(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `r${index}`, contactId: `c${index}`, waId: `9199${index}`, contactName: `Name ${index}`,
  }));
}

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    id: campaignId, workspaceId, name: "Launch", phoneNumberId, wabaId: "w", templateName: "promo",
    templateLanguage: "en", templateVariables: [], status: "sending", counts: {}, ...overrides,
  };
}

describe("sendCampaignBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.expireStuck.mockResolvedValue(undefined);
    mocks.getCampaign.mockResolvedValue(campaign());
    mocks.transition.mockResolvedValue(true);
    mocks.connection.mockResolvedValue({ accessToken: "token" });
    mocks.quality.mockResolvedValue("GREEN");
    mocks.countWindow.mockResolvedValue(0);
    mocks.optedIn.mockImplementation(async (_w: string, ids: string[]) => new Set(ids));
    mocks.complete.mockResolvedValue(false);
    mocks.conversation.mockResolvedValue(null);
    mocks.settle.mockResolvedValue(undefined);
    mocks.logAttempt.mockResolvedValue(undefined);
  });

  it("pauses without claiming anything when the number is YELLOW", async () => {
    mocks.quality.mockResolvedValue("YELLOW");
    const summary = await sendCampaignBatch({ workspaceId, campaignId });
    expect(summary.status).toBe("paused");
    expect(summary.pausedReason).toMatch(/YELLOW/);
    expect(mocks.transition).toHaveBeenCalledWith(workspaceId, campaignId, "pause", expect.stringContaining("YELLOW"));
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("stops cleanly at the daily cap, claims nothing and does not fail anyone", async () => {
    mocks.countWindow.mockResolvedValue(DAILY_SEND_CAP);
    const summary = await sendCampaignBatch({ workspaceId, campaignId });
    expect(summary.capReason).toMatch(/Daily cap/);
    expect(summary.status).toBe("sending");
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.transition).not.toHaveBeenCalled();
  });

  it("claims no more than the remaining daily budget", async () => {
    mocks.countWindow.mockResolvedValue(DAILY_SEND_CAP - 2);
    mocks.claim.mockResolvedValue(recipients(2));
    mocks.sendMessage.mockResolvedValue({ messages: [{ id: "wamid.1" }] });
    await sendCampaignBatch({ workspaceId, campaignId, limit: 40 });
    expect(mocks.claim).toHaveBeenCalledWith(workspaceId, campaignId, 2);
  });

  it("pauses on a Meta throughput error and hands back the refused and remaining recipients", async () => {
    mocks.claim.mockResolvedValue(recipients(3));
    mocks.sendMessage
      .mockResolvedValueOnce({ messages: [{ id: "wamid.1" }] })
      .mockRejectedValueOnce(new MetaSendError("Meta send error: rate", 400, 130429));
    const summary = await sendCampaignBatch({ workspaceId, campaignId });
    expect(summary.status).toBe("paused");
    expect(summary.pausedReason).toMatch(/Sending paused/);
    expect(summary.released).toBe(2);
    expect(mocks.settle).toHaveBeenCalledWith({ recipientId: "r1", status: "pending" });
    expect(mocks.settle).toHaveBeenCalledWith({ recipientId: "r2", status: "pending" });
    expect(mocks.logAttempt).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: "r1", outcome: "rejected", metaCode: 130429,
    }));
  });

  it("never retries an uncertain outcome: it is marked uncertain and not released", async () => {
    mocks.claim.mockResolvedValue(recipients(1));
    mocks.sendMessage.mockRejectedValue(new Error("socket hang up"));
    const summary = await sendCampaignBatch({ workspaceId, campaignId });
    expect(summary.uncertain).toBe(1);
    expect(summary.released).toBe(0);
    expect(mocks.settle).toHaveBeenCalledWith(expect.objectContaining({ recipientId: "r0", status: "uncertain" }));
    expect(mocks.logAttempt).toHaveBeenCalledWith(expect.objectContaining({ recipientId: "r0", outcome: "uncertain" }));
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("logs one attempt row per accepted send", async () => {
    mocks.claim.mockResolvedValue(recipients(2));
    mocks.sendMessage
      .mockResolvedValueOnce({ messages: [{ id: "wamid.1" }] })
      .mockResolvedValueOnce({ messages: [{ id: "wamid.2" }] });
    const summary = await sendCampaignBatch({ workspaceId, campaignId });
    expect(summary.sent).toBe(2);
    expect(mocks.logAttempt).toHaveBeenCalledTimes(2);
    expect(mocks.logAttempt).toHaveBeenNthCalledWith(1, expect.objectContaining({ outcome: "accepted" }));
  });
});

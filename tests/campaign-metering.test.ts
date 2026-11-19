import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), count: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ requireApiSession: mocks.auth }));
vi.mock("@/lib/campaigns/access", () => ({ campaignAccessBlock: mocks.access }));
vi.mock("@/lib/campaigns/metering", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/campaigns/metering")>()),
  countCampaignSendsInMonth: mocks.count,
}));

import { GET } from "../app/api/campaigns/usage/route";
import { campaignCharge, kolkataMonthBounds, kolkataMonthKey } from "../lib/campaigns/metering";

const session = { userId: "user-1", email: "owner@example.test", tenantId: "ws-1", tenantName: "WS", role: "owner" };

function get(): NextRequest {
  return new NextRequest("https://xeccel.com/api/campaigns/usage", { headers: { origin: "https://xeccel.com" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue(null);
});

describe("Kolkata calendar month", () => {
  it("rolls over at local midnight in Asia/Kolkata, not at UTC midnight", () => {
    // 23:59:59 IST on 31 Oct 2026 is still October.
    expect(kolkataMonthKey(new Date("2026-10-31T18:29:59.999Z"))).toBe("2026-10");
    // 00:00:00 IST on 1 Nov 2026 is November.
    expect(kolkataMonthKey(new Date("2026-10-31T18:30:00.000Z"))).toBe("2026-11");
  });

  it("gives month bounds that start and end at Kolkata midnight", () => {
    const { start, end } = kolkataMonthBounds("2026-11");
    expect(start.toISOString()).toBe("2026-10-31T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-11-30T18:30:00.000Z");
  });

  it("handles the December to January year boundary", () => {
    expect(kolkataMonthKey(new Date("2026-12-31T18:30:00.000Z"))).toBe("2027-01");
    expect(kolkataMonthBounds("2026-12").end.toISOString()).toBe("2026-12-31T18:30:00.000Z");
  });

  it("rejects malformed month keys", () => {
    expect(() => kolkataMonthBounds("2026-13")).toThrow();
    expect(() => kolkataMonthBounds("26-11")).toThrow();
  });
});

describe("campaignCharge", () => {
  it("charges only the monthly fee when sends stay within the quota", () => {
    expect(campaignCharge(0)).toMatchObject({
      sends: 0, includedSends: 10000, sendsRemaining: 10000, extraSends: 0,
      addonFeeInr: 1499, extraSendChargeInr: 0, totalInr: 1499,
    });
  });

  it("holds the quota boundary: 10,000 sends is still free, 10,001 is the first extra", () => {
    const atQuota = campaignCharge(10000);
    expect(atQuota.sendsRemaining).toBe(0);
    expect(atQuota.extraSends).toBe(0);
    expect(atQuota.totalInr).toBe(1499);

    const first = campaignCharge(10001);
    expect(first.sendsRemaining).toBe(0);
    expect(first.extraSends).toBe(1);
    expect(first.extraSendChargeInr).toBe(0.1);
    expect(first.totalInr).toBe(1499.1);
  });

  it("charges ₹0.10 per send above the quota", () => {
    const charge = campaignCharge(10500);
    expect(charge.extraSends).toBe(500);
    expect(charge.extraSendChargeInr).toBe(50);
    expect(charge.totalInr).toBe(1549);
  });

  it("does not drift with floating point over large volumes", () => {
    expect(campaignCharge(10000 + 3).extraSendChargeInr).toBe(0.3);
    expect(campaignCharge(120000).extraSendChargeInr).toBe(11000);
  });

  it("treats invalid input as zero sends", () => {
    expect(campaignCharge(-5).sends).toBe(0);
    expect(campaignCharge(Number.NaN).totalInr).toBe(1499);
    expect(campaignCharge(12.9).sends).toBe(12);
  });
});

describe("GET /api/campaigns/usage", () => {
  it("refuses roles other than owner and admin, before any usage is read", async () => {
    mocks.auth.mockImplementation(async (_request: NextRequest, roles: string[]) => {
      if (!roles.includes("agent")) {
        return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
      }
      return { ok: true, session: { ...session, role: "agent" } };
    });

    const response = await GET(get());
    expect(response.status).toBe(403);
    expect(mocks.auth).toHaveBeenCalledWith(expect.any(NextRequest), ["owner", "admin"]);
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it("returns this month's sends and charge for an owner, uncached", async () => {
    mocks.auth.mockResolvedValue({ ok: true, session });
    mocks.count.mockResolvedValue(10250);

    const response = await GET(get());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.count).toHaveBeenCalledWith("ws-1", kolkataMonthKey(new Date()));

    const body = await response.json();
    expect(body.data.timezone).toBe("Asia/Kolkata");
    expect(body.data.month).toMatch(/^\d{4}-\d{2}$/);
    expect(body.data.charge).toMatchObject({
      sends: 10250, includedSends: 10000, sendsRemaining: 0, extraSends: 250,
      addonFeeInr: 1499, extraSendChargeInr: 25, totalInr: 1524,
    });
  });

  it("returns 503 without leaking details when the usage read fails", async () => {
    mocks.auth.mockResolvedValue({ ok: true, session });
    mocks.count.mockRejectedValue(new Error("connection reset"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(get());
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).error).toBe("Campaign usage is temporarily unavailable");
    spy.mockRestore();
  });
});

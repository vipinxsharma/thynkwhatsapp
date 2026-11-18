import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { describePartnerStatus, summarizeConnections, type PartnerConnectionRow } from "../lib/partner-solutions/status";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ requireApiSession: mocks.auth }));
vi.mock("@/lib/partner-solutions/store", () => ({ listPartnerConnections: mocks.list }));

import { GET } from "../app/api/partner-solutions/route";

const now = new Date("2026-11-19T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function row(overrides: Partial<PartnerConnectionRow> = {}): PartnerConnectionRow {
  return {
    wabaId: "waba-1",
    phoneNumberId: "phone-1",
    displayPhoneNumber: "+91 98765 43210",
    verifiedName: "Acme Retail",
    status: "connected",
    webhookSubscribed: true,
    tokenExpiresAt: null,
    tokenCheckedAt: now.toISOString(),
    tokenRefreshError: null,
    connectedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("describePartnerStatus", () => {
  it("reports a healthy connection that does not expire as connected with no next step", () => {
    expect(describePartnerStatus(row(), now)).toEqual({ tone: "ok", label: "Connected", nextStep: null });
  });

  it("asks for a reconnect when the number is disconnected", () => {
    const status = describePartnerStatus(row({ status: "disconnected" }), now);
    expect(status.tone).toBe("action");
    expect(status.nextStep).toMatch(/Reconnect/);
  });

  it("sends restricted numbers to Meta Business Manager, not to a Xeccel action", () => {
    const status = describePartnerStatus(row({ status: "restricted" }), now);
    expect(status.label).toBe("Restricted by Meta");
    expect(status.nextStep).toMatch(/Meta Business Manager/);
  });

  it("flags a token refresh error as needing a reconnect", () => {
    const status = describePartnerStatus(row({ tokenRefreshError: "invalid" }), now);
    expect(status.tone).toBe("action");
    expect(status.label).toBe("Access needs renewing");
  });

  it("treats access inside the renewal window as scheduled, with no action needed", () => {
    const status = describePartnerStatus(row({ tokenExpiresAt: new Date(now.getTime() + 5 * DAY).toISOString() }), now);
    expect(status.tone).toBe("warn");
    expect(status.label).toBe("Renewal scheduled");
    expect(status.nextStep).toMatch(/No action needed/);
  });

  it("is quiet about access that is still well within its lifetime", () => {
    const status = describePartnerStatus(row({ tokenExpiresAt: new Date(now.getTime() + 40 * DAY).toISOString() }), now);
    expect(status.label).toBe("Connected");
  });

  it("flags access past its expiry", () => {
    const status = describePartnerStatus(row({ tokenExpiresAt: new Date(now.getTime() - DAY).toISOString() }), now);
    expect(status.label).toBe("Access expired");
    expect(status.tone).toBe("action");
  });

  it("warns when incoming message delivery is not set up", () => {
    const status = describePartnerStatus(row({ webhookSubscribed: false }), now);
    expect(status.tone).toBe("warn");
    expect(status.label).toBe("Message delivery not set up");
  });

  it("does not crash on an unreadable expiry date", () => {
    const status = describePartnerStatus(row({ tokenExpiresAt: "not-a-date" }), now);
    expect(status.label).toBe("Access expiry unknown");
  });
});

describe("summarizeConnections", () => {
  it("counts connected and needs-attention numbers", () => {
    const summary = summarizeConnections(
      [row(), row({ wabaId: "w2", phoneNumberId: "p2", status: "restricted" }), row({ webhookSubscribed: false, wabaId: "w3", phoneNumberId: "p3" })],
      now
    );
    expect(summary).toEqual({ total: 3, connected: 1, needsAction: 1 });
  });
});

describe("GET /api/partner-solutions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ ok: true, session: { tenantId: "ws-1", role: "agent" } });
  });

  it("returns statuses without access tokens", async () => {
    mocks.list.mockResolvedValue([row()]);
    const response = await GET(new NextRequest("https://xeccel.com/api/partner-solutions"));
    const body = (await response.json()) as { data: { connections: Array<Record<string, unknown>> } };
    expect(response.status).toBe(200);
    expect(body.data.connections[0]).toHaveProperty("status.label", "Connected");
    expect(JSON.stringify(body)).not.toMatch(/accessToken|encrypted/i);
    expect(mocks.list).toHaveBeenCalledWith("ws-1");
  });

  it("returns 503 without leaking details when the store fails", async () => {
    mocks.list.mockRejectedValue(new Error("db down"));
    const response = await GET(new NextRequest("https://xeccel.com/api/partner-solutions"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/db down/);
  });

  it("passes the auth failure response through", async () => {
    mocks.auth.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const response = await GET(new NextRequest("https://xeccel.com/api/partner-solutions"));
    expect(response.status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });
});

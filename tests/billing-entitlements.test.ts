import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "../lib/auth/session";
import { GET as getEntitlements } from "../app/api/billing/entitlements/route";
import {
  evaluateEntitlement,
  getEntitlementSnapshot,
  type EntitlementSnapshot,
} from "../lib/billing/entitlements";

vi.mock("../lib/workspaces/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/workspaces/store")>();
  return {
    ...actual,
    validateWorkspaceMembership: vi.fn(async (_userId: string, workspaceId: string) => ({
      workspaceId,
      workspaceName: "Test workspace",
      workspaceSlug: "test-workspace",
      role: "owner",
    })),
  };
});

vi.mock("../lib/billing/entitlements", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/billing/entitlements")>();
  return { ...actual, getEntitlementSnapshot: vi.fn() };
});

const active: EntitlementSnapshot = {
  status: "active",
  planCode: "test_plan",
  currentPeriodStart: "2020-01-01T00:00:00.000Z",
  currentPeriodEnd: "2030-01-01T00:00:00.000Z",
  features: ["whatsapp_send"],
};

async function authenticatedRequest(tenantId: string) {
  const token = await createSessionToken({
    userId: "test-user",
    email: "test@example.com",
    tenantId,
    tenantName: "Test workspace",
    role: "owner",
  });
  return new NextRequest("http://localhost:3000/api/billing/entitlements", {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("subscription entitlement foundation", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SESSION_SECRET", "test-auth-session-secret-that-is-at-least-32-characters");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("fails closed without a verified, current subscription and explicit grant", () => {
    const now = new Date("2029-01-01T00:00:00.000Z");
    expect(evaluateEntitlement({ status: "none", planCode: null, currentPeriodStart: null, currentPeriodEnd: null, features: [] }, "whatsapp_send", now))
      .toEqual({ allowed: false, reason: "no_subscription" });
    expect(evaluateEntitlement({ ...active, status: "past_due" }, "whatsapp_send", now))
      .toEqual({ allowed: false, reason: "inactive" });
    expect(evaluateEntitlement({ ...active, currentPeriodEnd: "2028-01-01T00:00:00.000Z" }, "whatsapp_send", now))
      .toEqual({ allowed: false, reason: "outside_period" });
    expect(evaluateEntitlement({ ...active, currentPeriodStart: "2030-01-01T00:00:00.000Z" }, "whatsapp_send", now))
      .toEqual({ allowed: false, reason: "outside_period" });
    expect(evaluateEntitlement(active, "campaign_send", now))
      .toEqual({ allowed: false, reason: "feature_not_granted" });
    expect(evaluateEntitlement(active, "whatsapp_send", now)).toEqual({ allowed: true });
  });

  it("requires authentication for the customer entitlement view", async () => {
    const response = await getEntitlements(new NextRequest("http://localhost:3000/api/billing/entitlements"));
    expect(response.status).toBe(401);
    expect(getEntitlementSnapshot).not.toHaveBeenCalled();
  });

  it("uses the signed workspace and exposes only currently usable features", async () => {
    vi.mocked(getEntitlementSnapshot).mockResolvedValueOnce(active);
    const response = await getEntitlements(await authenticatedRequest("11111111-1111-4111-8111-111111111111"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(getEntitlementSnapshot).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
    expect(await response.json()).toMatchObject({ status: "active", features: ["whatsapp_send"] });
  });

  it("does not expose a grant on an inactive subscription", async () => {
    vi.mocked(getEntitlementSnapshot).mockResolvedValueOnce({ ...active, status: "cancelled" });
    const response = await getEntitlements(await authenticatedRequest("11111111-1111-4111-8111-111111111111"));
    expect((await response.json()).features).toEqual([]);
  });
});

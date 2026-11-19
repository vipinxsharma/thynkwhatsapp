import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn(), save: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ requireApiSession: mocks.auth }));
vi.mock("@/lib/crm/store", () => ({ getCrmChoice: mocks.get, saveCrmChoice: mocks.save }));

import { GET, POST } from "../app/api/crm/selection/route";
import { crmOptions, findCrmOption, isCrmCode } from "../lib/crm/options";
import { billingPlans, crmOfferFeature } from "../lib/billing/plans";

const session = { userId: "user-1", email: "owner@example.test", tenantId: "ws-1", tenantName: "WS", role: "owner" };

function post(body: unknown): NextRequest {
  return new NextRequest("https://xeccel.com/api/crm/selection", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://xeccel.com" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ ok: true, session });
});

describe("CRM options", () => {
  it("offers exactly Coldcall.in and SuperCRM", () => {
    expect(crmOptions.map((option) => option.code)).toEqual(["coldcall", "supercrm"]);
    expect(isCrmCode("coldcall")).toBe(true);
    expect(isCrmCode("salesforce")).toBe(false);
    expect(isCrmCode(undefined)).toBe(false);
  });

  it("describes the free Coldcall.in offer as 1 user and 1 web admin", () => {
    const coldcall = findCrmOption("coldcall");
    expect(coldcall?.included).toEqual(["1 user", "1 web admin access"]);
    expect(coldcall?.signupUrl).toMatch(/^https:\/\//);
  });

  it("sends SuperCRM sign-ups to the thynkWISE trial application", () => {
    const supercrm = findCrmOption("supercrm");
    expect(supercrm?.signupUrl).toBe("https://thynkwise.co.in/supercrm#start-trial");
    expect(supercrm?.included).toContain("SuperCRM basic plan");
  });

  it("gives each CRM option a logo file that exists in /public", () => {
    for (const option of crmOptions) {
      expect(option.logoSrc).toMatch(/^\/crm\/[a-z]+\.png$/);
      expect(existsSync(join(process.cwd(), "public", option.logoSrc))).toBe(true);
    }
  });

  it("lists the CRM offer on every plan", () => {
    for (const plan of billingPlans) expect(plan.features).toContain(crmOfferFeature);
  });
});

describe("CRM selection route", () => {
  it("returns the workspace's current choice", async () => {
    mocks.get.mockResolvedValue({ crmCode: "coldcall", status: "requested", updatedAt: "2026-11-19T00:00:00.000Z" });
    const response = await GET(new NextRequest("https://xeccel.com/api/crm/selection"));
    expect(response.status).toBe(200);
    expect((await response.json()).data.crmCode).toBe("coldcall");
    expect(mocks.get).toHaveBeenCalledWith("ws-1");
  });

  it("saves a valid choice for the signed-in workspace", async () => {
    mocks.save.mockResolvedValue({ crmCode: "supercrm", status: "requested", updatedAt: "2026-11-19T00:00:00.000Z" });
    const response = await POST(post({ crmCode: "supercrm" }));
    expect(response.status).toBe(200);
    expect(mocks.auth).toHaveBeenCalledWith(expect.anything(), ["owner", "admin"]);
    expect(mocks.save).toHaveBeenCalledWith({
      workspaceId: "ws-1", crmCode: "supercrm", authUserId: "user-1", contactEmail: "owner@example.test",
    });
  });

  it("rejects an unknown CRM without saving", async () => {
    const response = await POST(post({ crmCode: "other" }));
    expect(response.status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("reports a conflict when access is already provisioned for the other CRM", async () => {
    mocks.save.mockResolvedValue({ crmCode: "coldcall", status: "provisioned", updatedAt: "2026-11-19T00:00:00.000Z" });
    const response = await POST(post({ crmCode: "supercrm" }));
    expect(response.status).toBe(409);
    expect((await response.json()).data.crmCode).toBe("coldcall");
  });

  it("passes through the auth failure for members who may not choose", async () => {
    const denied = new Response(null, { status: 403 });
    mocks.auth.mockResolvedValue({ ok: false, response: denied });
    expect((await POST(post({ crmCode: "coldcall" }))).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });
});

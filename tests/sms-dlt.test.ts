import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "../lib/auth/session";
import { parseDltDraft, getDltDraft, saveDltDraft } from "../lib/sms/dlt";
import { GET, PUT } from "../app/api/sms/dlt/route";
import { validateWorkspaceMembership } from "../lib/workspaces/store";

vi.mock("../lib/workspaces/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/workspaces/store")>();
  return { ...actual, validateWorkspaceMembership: vi.fn() };
});
vi.mock("../lib/sms/dlt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/sms/dlt")>();
  return { ...actual, getDltDraft: vi.fn(), saveDltDraft: vi.fn() };
});

const draft = { accessProvider: "vi" as const, principalEntityId: "12345", deliveryPartnerName: "Example", updatedAt: "2026-10-14T00:00:00Z" };

async function request(workspaceId: string, role: "owner" | "admin" | "viewer", method = "GET", body?: object) {
  const token = await createSessionToken({ userId: "user-1", email: "user@example.com", tenantId: workspaceId, tenantName: "Test", role });
  return new NextRequest("http://localhost:3000/api/sms/dlt", {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("SMS DLT readiness draft", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SESSION_SECRET", "test-auth-session-secret-that-is-at-least-32-characters");
    vi.stubEnv("DATABASE_URL", "postgresql://unused-for-mocked-tests");
    vi.mocked(validateWorkspaceMembership).mockImplementation(async (_userId, workspaceId) => ({
      workspaceId, workspaceName: "Test", workspaceSlug: "test", role: workspaceId === "viewer-workspace" ? "viewer" : "admin",
    }));
    vi.mocked(getDltDraft).mockResolvedValue(draft);
    vi.mocked(saveDltDraft).mockResolvedValue(draft);
  });

  afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

  it("validates and normalizes only supported draft fields", () => {
    expect(parseDltDraft({ accessProvider: "vi", principalEntityId: " 12345 ", deliveryPartnerName: "  Example  " }))
      .toEqual({ accessProvider: "vi", principalEntityId: "12345", deliveryPartnerName: "Example" });
    expect(parseDltDraft({ accessProvider: "unknown" })).toBeNull();
    expect(parseDltDraft({ accessProvider: "vi", principalEntityId: "bad value" })).toBeNull();
    expect(parseDltDraft({ accessProvider: "vi", deliveryPartnerName: "x".repeat(121) })).toBeNull();
  });

  it("reads only the authenticated workspace", async () => {
    const response = await GET(await request("workspace-a", "admin"));
    expect(response.status).toBe(200);
    expect(getDltDraft).toHaveBeenCalledWith("workspace-a");
  });

  it("blocks viewer edits and uses the session workspace on saves", async () => {
    const viewer = await PUT(await request("viewer-workspace", "viewer", "PUT", draft));
    expect(viewer.status).toBe(403);
    expect(saveDltDraft).not.toHaveBeenCalled();
    const owner = await PUT(await request("workspace-a", "owner", "PUT", { ...draft, workspaceId: "workspace-b" }));
    expect(owner.status).toBe(200);
    expect(saveDltDraft).toHaveBeenCalledWith("workspace-a", "user-1", {
      accessProvider: "vi", principalEntityId: "12345", deliveryPartnerName: "Example",
    });
  });

  it("rejects malformed draft data", async () => {
    const response = await PUT(await request("workspace-a", "admin", "PUT", { accessProvider: "invalid" }));
    expect(response.status).toBe(400);
    expect(saveDltDraft).not.toHaveBeenCalled();
  });
});

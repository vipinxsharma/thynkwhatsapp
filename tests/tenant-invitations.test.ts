import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  requireApiSession: vi.fn(),
  isPlatformSuperadmin: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@neondatabase/serverless", () => ({ neon: () => ({ query: mocks.query }) }));
vi.mock("@/lib/auth/session", () => ({ requireApiSession: mocks.requireApiSession }));
vi.mock("@/lib/auth/platform-admin", () => ({ isPlatformSuperadmin: mocks.isPlatformSuperadmin }));
vi.mock("@/lib/auth/neon", () => ({ neonAuth: { getSession: mocks.getSession } }));

import { requirePlatformApiSuperadmin } from "../lib/auth/platform-api";
import { acceptWorkspaceInvitation, hashInvitationToken } from "../lib/workspaces/team";
import { parseTenantInviteInput } from "../lib/workspaces/tenant-invites";

const TOKEN = "a".repeat(43);
const session = { userId: "admin-1", email: "partner@thynkwise.co.in", tenantId: "t-1", tenantName: "T", role: "owner" };
const request = { nextUrl: { origin: "https://app.example" } } as never;
const membership = { workspaceId: "w-1", workspaceName: "Partner Salon", workspaceSlug: "partner-salon", role: "owner" };

describe("platform superadmin guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgres://test";
  });

  it("returns 404 when the request is not authenticated", async () => {
    mocks.requireApiSession.mockResolvedValueOnce({ ok: false, response: new Response(null, { status: 401 }) });
    const result = await requirePlatformApiSuperadmin(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(404);
  });

  it("returns 404 to a signed-in non-superadmin", async () => {
    mocks.requireApiSession.mockResolvedValueOnce({ ok: true, session });
    mocks.isPlatformSuperadmin.mockResolvedValueOnce(false);
    const result = await requirePlatformApiSuperadmin(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(404);
  });

  it("admits a verified superadmin", async () => {
    mocks.requireApiSession.mockResolvedValueOnce({ ok: true, session });
    mocks.isPlatformSuperadmin.mockResolvedValueOnce(true);
    const result = await requirePlatformApiSuperadmin(request);
    expect(result).toEqual({ ok: true, session });
  });
});

describe("tenant owner invite input", () => {
  it("normalises email and rejects bad input", () => {
    expect(parseTenantInviteInput({ email: " Partner@Example.com ", workspaceName: "Salon" })).toEqual({
      email: "partner@example.com",
      workspaceName: "Salon",
    });
    expect(parseTenantInviteInput({ email: "nope", workspaceName: "Salon" })).toBeNull();
    expect(parseTenantInviteInput({ email: "a@b.co", workspaceName: "" })).toBeNull();
  });
});

describe("tenant_owner acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgres://test";
  });

  const input = { token: TOKEN, authUserId: "partner-1", email: "partner@thynkwise.co.in", emailVerified: true };

  it("creates the workspace on success", async () => {
    mocks.query
      .mockResolvedValueOnce([{ kind: "tenant_owner" }])
      .mockResolvedValueOnce([{ id: "inv-1", workspace_name: "Partner Salon" }])
      .mockResolvedValueOnce([membership]);
    await expect(acceptWorkspaceInvitation(input)).resolves.toEqual(membership);
    const [sqlText, params] = mocks.query.mock.calls[2];
    expect(sqlText).toContain("INSERT INTO app_workspaces");
    expect(params).toContain(hashInvitationToken(TOKEN));
  });

  it("refuses an expired, revoked or wrong-email invite without creating anything", async () => {
    // The lookup filters on expiry, revocation and email, so none of these match.
    mocks.query.mockResolvedValueOnce([]);
    await expect(acceptWorkspaceInvitation(input)).resolves.toBeNull();
    expect(mocks.query).toHaveBeenCalledTimes(1);
    const [lookupSql, params] = mocks.query.mock.calls[0];
    expect(lookupSql).toContain("expires_at > now()");
    expect(lookupSql).toContain("revoked_at IS NULL");
    expect(lookupSql).toContain("lower(invited_email) = lower($2)");
    expect(params).toEqual([hashInvitationToken(TOKEN), input.email]);
  });

  it("refuses an unverified email before touching the database again", async () => {
    mocks.query.mockResolvedValueOnce([{ kind: "tenant_owner" }]);
    await expect(acceptWorkspaceInvitation({ ...input, emailVerified: false })).rejects.toThrow("EMAIL_NOT_VERIFIED");
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("refuses when the tenant_owner row is no longer acceptable at the write step", async () => {
    mocks.query.mockResolvedValueOnce([{ kind: "tenant_owner" }]).mockResolvedValueOnce([]);
    await expect(acceptWorkspaceInvitation(input)).resolves.toBeNull();
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
});

describe("member invite regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgres://test";
  });

  it("still accepts a member invite with the original single-statement path", async () => {
    mocks.query
      .mockResolvedValueOnce([{ kind: "member" }])
      .mockResolvedValueOnce([{ ...membership, role: "agent" }]);
    const result = await acceptWorkspaceInvitation({
      token: TOKEN,
      authUserId: "partner-1",
      email: "partner@thynkwise.co.in",
    });
    expect(result).toEqual({ ...membership, role: "agent" });
    const memberSql = mocks.query.mock.calls[1][0] as string;
    expect(memberSql).toContain("i.kind = 'member'");
    expect(memberSql).toContain("ON CONFLICT (workspace_id, auth_user_id)");
    expect(memberSql).not.toContain("tenant_owner");
  });

  it("does not require a verified email for member invites", async () => {
    mocks.query.mockResolvedValueOnce([{ kind: "member" }]).mockResolvedValueOnce([membership]);
    await expect(
      acceptWorkspaceInvitation({ token: TOKEN, authUserId: "u", email: "e@x.co", emailVerified: false })
    ).resolves.toEqual(membership);
  });
});

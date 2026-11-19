import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  exchange: vi.fn(),
  grant: vi.fn(),
  accounts: vi.fn(),
  revoke: vi.fn(),
  save: vi.fn(),
  getConnection: vi.fn(),
  getEncryptedToken: vi.fn(),
  markDisconnected: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireApiSession: mocks.auth }));
vi.mock("@/lib/ads/graph", () => ({
  exchangeAdsCode: mocks.exchange,
  fetchAdsGrant: mocks.grant,
  fetchAdAccounts: mocks.accounts,
  revokeAdsRead: mocks.revoke,
}));
vi.mock("@/lib/ads/connection-store", () => ({
  saveAdsConnection: mocks.save,
  getAdsConnection: mocks.getConnection,
  getEncryptedAdsToken: mocks.getEncryptedToken,
  markAdsDisconnected: mocks.markDisconnected,
}));

import { GET as authorize } from "../app/api/meta/ads/authorize/route";
import { GET as callback } from "../app/api/meta/ads/callback/route";
import { DELETE as disconnect, GET as connectionStatus } from "../app/api/meta/ads/connection/route";
import { signAdsOAuthState, verifyAdsOAuthState } from "../lib/ads/oauth";
import { decryptToken, encryptToken } from "../lib/meta/encryption";

const SECRET = "test-encryption-key-with-at-least-32-characters";
const NONCE = "nonce-value-0123456789abcdef";
const session = { ok: true, session: { tenantId: "ws-1", userId: "user-1", role: "owner" } };

function state(overrides: Record<string, unknown> = {}) {
  return signAdsOAuthState(
    { workspaceId: "ws-1", authUserId: "user-1", nonce: NONCE, issuedAt: Date.now(), ...overrides } as never,
    SECRET,
  );
}

function callbackRequest(query: Record<string, string>, cookie: string | null = `ads_oauth_nonce=${NONCE}`) {
  const url = new URL("https://app.test/api/meta/ads/callback");
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  return new NextRequest(url, { headers: cookie ? { cookie } : {} });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("NEXT_PUBLIC_META_APP_ID", "123456789012345");
  vi.stubEnv("META_APP_SECRET", "meta-app-secret-for-tests-only-123");
  vi.stubEnv("ENCRYPTION_KEY", SECRET);
  vi.stubEnv("DATABASE_URL", "postgres://test");
  mocks.auth.mockResolvedValue(session);
  mocks.exchange.mockResolvedValue({ accessToken: "user-token", expiresIn: 5184000 });
  mocks.grant.mockResolvedValue({ metaUserId: "10001", adsReadGranted: true });
  mocks.accounts.mockResolvedValue([{ id: "act_111", name: "Main", accountStatus: "1" }]);
  mocks.revoke.mockResolvedValue(true);
  mocks.save.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("authorize", () => {
  it("redirects to the Meta dialog for ads_read only and sets a browser-bound nonce", async () => {
    const response = await authorize(new NextRequest("https://app.test/api/meta/ads/authorize"));

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") as string);
    expect(location.hostname).toBe("www.facebook.com");
    expect(location.searchParams.get("scope")).toBe("ads_read");
    expect(location.searchParams.get("redirect_uri")).toBe("https://app.test/api/meta/ads/callback");

    const verified = verifyAdsOAuthState(location.searchParams.get("state") || "", SECRET);
    const cookie = response.cookies.get("ads_oauth_nonce");
    expect(verified?.workspaceId).toBe("ws-1");
    expect(verified?.authUserId).toBe("user-1");
    expect(cookie?.value).toBe(verified?.nonce);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe("/api/meta/ads");
  });

  it("sends the user back to the consent page when the connection is not configured", async () => {
    vi.stubEnv("META_APP_SECRET", "");
    const response = await authorize(new NextRequest("https://app.test/api/meta/ads/authorize"));
    expect(response.headers.get("location")).toBe("https://app.test/growth/ads/connect?status=unavailable");
  });

  it("returns the session failure unchanged for a member without access", async () => {
    mocks.auth.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const response = await authorize(new NextRequest("https://app.test/api/meta/ads/authorize"));
    expect(response.status).toBe(403);
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
});

describe("callback", () => {
  it("stores an encrypted ads_read connection after a valid round trip", async () => {
    const response = await callback(callbackRequest({ code: "code-1", state: state() }));

    expect(response.headers.get("location")).toBe("https://app.test/growth/ads/connect?status=connected");
    expect(mocks.exchange).toHaveBeenCalledWith({ code: "code-1", redirectUri: "https://app.test/api/meta/ads/callback" });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    const saved = mocks.save.mock.calls[0][0];
    expect(saved).toMatchObject({ workspaceId: "ws-1", authUserId: "user-1", metaUserId: "10001" });
    expect(saved.encryptedToken.ciphertext).not.toContain("user-token");
    expect(decryptToken(saved.encryptedToken)).toBe("user-token");
    expect(saved.tokenExpiresAt).toEqual(expect.any(String));
    expect(saved.adAccounts).toEqual([{ id: "act_111", name: "Main", accountStatus: "1" }]);
    expect(response.cookies.get("ads_oauth_nonce")?.value).toBe("");
  });

  it("stores nothing and removes the grant when ads_read was not granted", async () => {
    mocks.grant.mockResolvedValueOnce({ metaUserId: "10001", adsReadGranted: false });
    const response = await callback(callbackRequest({ code: "code-1", state: state() }));

    expect(response.headers.get("location")).toContain("status=not_granted");
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.revoke).toHaveBeenCalledWith("user-token");
  });

  it("rejects a callback without the browser nonce", async () => {
    const response = await callback(callbackRequest({ code: "code-1", state: state() }, null));
    expect(response.headers.get("location")).toContain("status=invalid_state");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("rejects a nonce that does not match the state", async () => {
    const response = await callback(
      callbackRequest({ code: "code-1", state: state() }, "ads_oauth_nonce=different-nonce-0123456789"),
    );
    expect(response.headers.get("location")).toContain("status=invalid_state");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("rejects a state issued for another workspace or user", async () => {
    const otherWorkspace = await callback(callbackRequest({ code: "c", state: state({ workspaceId: "ws-2" }) }));
    expect(otherWorkspace.headers.get("location")).toContain("status=invalid_state");

    const otherUser = await callback(callbackRequest({ code: "c", state: state({ authUserId: "user-9" }) }));
    expect(otherUser.headers.get("location")).toContain("status=invalid_state");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("reports a cancelled consent without exchanging anything", async () => {
    const response = await callback(callbackRequest({ error: "access_denied", state: state() }));
    expect(response.headers.get("location")).toContain("status=denied");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("reports failure and stores nothing when the code exchange fails", async () => {
    mocks.exchange.mockRejectedValueOnce(new Error("Meta rejected the request: Invalid code"));
    const response = await callback(callbackRequest({ code: "code-1", state: state() }));
    expect(response.headers.get("location")).toContain("status=failed");
    expect(mocks.save).not.toHaveBeenCalled();
  });
});

describe("connection status and disconnect", () => {
  it("reports not connected when no row exists, without a token", async () => {
    mocks.getConnection.mockResolvedValueOnce(null);
    const response = await connectionStatus(new NextRequest("https://app.test/api/meta/ads/connection"));
    const body = await response.json();
    expect(body).toEqual({ connected: false, connection: null, scope: "ads_read" });
  });

  it("disconnects, revokes at Meta and clears the stored token", async () => {
    mocks.getEncryptedToken.mockResolvedValueOnce(encryptToken("user-token"));
    mocks.markDisconnected.mockResolvedValueOnce(true);
    mocks.revoke.mockResolvedValueOnce(true);

    const response = await disconnect(new NextRequest("https://app.test/api/meta/ads/connection", { method: "DELETE" }));
    expect(await response.json()).toEqual({ status: "disconnected", removed: true, revokedAtMeta: true });
    expect(mocks.revoke).toHaveBeenCalledWith("user-token");
    expect(mocks.markDisconnected).toHaveBeenCalledWith("ws-1");
  });

  it("still disconnects locally when Meta refuses the revoke, and says so", async () => {
    mocks.getEncryptedToken.mockResolvedValueOnce(encryptToken("user-token"));
    mocks.markDisconnected.mockResolvedValueOnce(true);
    mocks.revoke.mockRejectedValueOnce(new Error("network down"));

    const response = await disconnect(new NextRequest("https://app.test/api/meta/ads/connection", { method: "DELETE" }));
    const body = await response.json();
    expect(body).toEqual({ status: "disconnected", removed: true, revokedAtMeta: false });
    expect(mocks.markDisconnected).toHaveBeenCalled();
  });
});

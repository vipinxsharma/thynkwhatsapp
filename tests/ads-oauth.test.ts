import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADS_OAUTH_SCOPES,
  ADS_STATE_TTL_MS,
  adsRedirectUri,
  buildAdsConsentUrl,
  sameNonce,
  signAdsOAuthState,
  verifyAdsOAuthState,
  type AdsOAuthState,
} from "../lib/ads/oauth";
import { exchangeAdsCode, fetchAdAccounts, fetchAdsGrant, revokeAdsRead } from "../lib/ads/graph";

const SECRET = "test-encryption-key-with-at-least-32-characters";
const APP_SECRET = "meta-app-secret-for-tests-only-123";
const NOW = Date.UTC(2026, 10, 19, 12, 0, 0);

function state(overrides: Partial<AdsOAuthState> = {}): AdsOAuthState {
  return {
    workspaceId: "ws-1",
    authUserId: "user-1",
    nonce: "nonce-value-0123456789abcdef",
    issuedAt: NOW,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_META_APP_ID", "123456789012345");
  vi.stubEnv("META_APP_SECRET", APP_SECRET);
  vi.stubEnv("META_GRAPH_API_VERSION", "v27.0");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ads consent URL", () => {
  it("requests ads_read and nothing else", () => {
    expect(ADS_OAUTH_SCOPES).toEqual(["ads_read"]);
    const url = new URL(
      buildAdsConsentUrl({ appId: "123456789012345", redirectUri: "https://app.test/api/meta/ads/callback", state: "s.t" }),
    );
    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.pathname).toBe("/v27.0/dialog/oauth");
    expect(url.searchParams.get("scope")).toBe("ads_read");
    expect(url.searchParams.get("client_id")).toBe("123456789012345");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.test/api/meta/ads/callback");
    expect(url.searchParams.get("state")).toBe("s.t");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.toString()).not.toContain("ads_management");
  });

  it("builds the callback URL from the request origin", () => {
    expect(adsRedirectUri("https://app.test")).toBe("https://app.test/api/meta/ads/callback");
  });
});

describe("ads OAuth state", () => {
  it("verifies a state it signed", () => {
    const token = signAdsOAuthState(state(), SECRET);
    expect(verifyAdsOAuthState(token, SECRET, NOW + 1000)).toEqual(state());
  });

  it("rejects a state signed with another key", () => {
    const token = signAdsOAuthState(state(), SECRET);
    expect(verifyAdsOAuthState(token, "a-different-key-that-is-also-long-enough", NOW)).toBeNull();
  });

  it("rejects a tampered payload that would switch workspace", () => {
    const token = signAdsOAuthState(state(), SECRET);
    const [, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify(state({ workspaceId: "ws-other" })), "utf8").toString("base64url");
    expect(verifyAdsOAuthState(`${forged}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("rejects an expired state and one issued far in the future", () => {
    const token = signAdsOAuthState(state(), SECRET);
    expect(verifyAdsOAuthState(token, SECRET, NOW + ADS_STATE_TTL_MS + 1)).toBeNull();
    expect(verifyAdsOAuthState(token, SECRET, NOW - 5 * 60 * 1000)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifyAdsOAuthState("", SECRET, NOW)).toBeNull();
    expect(verifyAdsOAuthState("only-one-part", SECRET, NOW)).toBeNull();
    expect(verifyAdsOAuthState("a.b.c", SECRET, NOW)).toBeNull();
    const short = signAdsOAuthState(state({ nonce: "short" }), SECRET);
    expect(verifyAdsOAuthState(short, SECRET, NOW)).toBeNull();
  });

  it("compares nonces in constant time and rejects different lengths", () => {
    expect(sameNonce("abc123", "abc123")).toBe(true);
    expect(sameNonce("abc123", "abc124")).toBe(false);
    expect(sameNonce("abc", "abcdef")).toBe(false);
  });
});

describe("ads Graph calls", () => {
  it("exchanges the code and never puts the token in the URL of later calls", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ access_token: "user-token", expires_in: 5184000 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await exchangeAdsCode({ code: "code-1", redirectUri: "https://app.test/api/meta/ads/callback" });

    expect(result).toEqual({ accessToken: "user-token", expiresIn: 5184000 });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/v27.0/oauth/access_token");
    expect(url.searchParams.get("code")).toBe("code-1");
    expect(url.searchParams.get("client_secret")).toBe(APP_SECRET);
  });

  it("does not leak the app secret in the error when Meta refuses the code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { message: "Invalid code", code: 100 } }, 400)));

    const error = await exchangeAdsCode({ code: "bad", redirectUri: "https://app.test/cb" }).then(
      () => new Error("expected a rejection"),
      (e: unknown) => e as Error,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("Invalid code");
    expect(error.message).not.toContain(APP_SECRET);
  });

  it("reports ads_read as granted only when Meta lists it as granted", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.includes("/me/permissions")) {
        return jsonResponse({
          data: [
            { permission: "public_profile", status: "granted" },
            { permission: "ads_read", status: "granted" },
          ],
        });
      }
      return jsonResponse({ id: "10001" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const grant = await fetchAdsGrant("user-token");
    expect(grant).toEqual({ metaUserId: "10001", adsReadGranted: true });
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer user-token");
  });

  it("treats a declined ads_read as not granted", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, _init?: RequestInit) =>
      url.includes("/me/permissions")
        ? jsonResponse({ data: [{ permission: "ads_read", status: "declined" }] })
        : jsonResponse({ id: "10001" }),
    ));
    expect((await fetchAdsGrant("user-token")).adsReadGranted).toBe(false);
  });

  it("maps ad accounts and caps long names", async () => {
    const fetchMock = vi.fn(async (_url: string) =>
      jsonResponse({
        data: [
          { id: "act_111", name: "Main", account_status: 1 },
          { id: "act_222", name: "x".repeat(400), account_status: 2 },
          { name: "no id" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const accounts = await fetchAdAccounts("user-token");
    expect(accounts).toEqual([
      { id: "act_111", name: "Main", accountStatus: "1" },
      { id: "act_222", name: "x".repeat(200), accountStatus: "2" },
    ]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("limit=100");
  });

  it("revokes only the ads_read permission", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await revokeAdsRead("user-token")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("DELETE");
    expect(new URL(url).searchParams.get("permission")).toBe("ads_read");
  });

  it("reports a refused revoke without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { message: "nope" } }, 400)));
    expect(await revokeAdsRead("user-token")).toBe(false);
  });
});

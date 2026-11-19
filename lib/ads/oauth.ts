import crypto from "node:crypto";

// Read-only. The consent URL requests this scope and nothing else. ads_management is never requested,
// so the app cannot create ads, change budgets or change delivery.
export const ADS_READ_SCOPE = "ads_read";
export const ADS_OAUTH_SCOPES: readonly string[] = [ADS_READ_SCOPE];

export const ADS_STATE_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

/** Browser cookie that binds the callback to the browser that started the flow (CSRF protection). */
export const ADS_NONCE_COOKIE = "ads_oauth_nonce";
export const ADS_ROUTE_PREFIX = "/api/meta/ads";

/** Must match the redirect URI registered on the Meta app. */
export function adsRedirectUri(origin: string): string {
  return new URL(`${ADS_ROUTE_PREFIX}/callback`, origin).toString();
}

export function adsGraphVersion(): string {
  return process.env.META_GRAPH_API_VERSION || "v27.0";
}

/** The Meta login dialog for the ads connection. The user confirms the scope on Meta's own screen. */
export function buildAdsConsentUrl(input: { appId: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    state: input.state,
    scope: ADS_OAUTH_SCOPES.join(","),
    response_type: "code",
  });
  return `https://www.facebook.com/${adsGraphVersion()}/dialog/oauth?${params.toString()}`;
}

export type AdsOAuthState = {
  workspaceId: string;
  authUserId: string;
  nonce: string;
  issuedAt: number;
};

function stateKey(secret: string): Buffer {
  // A label keeps this key separate from the one that encrypts stored tokens.
  return crypto.createHash("sha256").update(`ads-oauth-state|${secret}`).digest();
}

/** Signs the state as `payload.signature`. The payload is base64url JSON and is not secret. */
export function signAdsOAuthState(state: AdsOAuthState, secret: string): string {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", stateKey(secret)).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

/**
 * Returns the state only when the signature matches, it has not expired and its shape is valid.
 * The caller must also compare `nonce` with the browser cookie set at authorize time.
 */
export function verifyAdsOAuthState(token: string, secret: string, now = Date.now()): AdsOAuthState | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  const expected = crypto.createHmac("sha256", stateKey(secret)).update(payload).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const state = parsed as Partial<AdsOAuthState>;
  if (
    typeof state.workspaceId !== "string" || !state.workspaceId ||
    typeof state.authUserId !== "string" || !state.authUserId ||
    typeof state.nonce !== "string" || state.nonce.length < 16 || state.nonce.length > 100 ||
    typeof state.issuedAt !== "number" || !Number.isFinite(state.issuedAt)
  ) {
    return null;
  }
  const age = now - state.issuedAt;
  if (age > ADS_STATE_TTL_MS || age < -CLOCK_SKEW_MS) return null;

  return {
    workspaceId: state.workspaceId,
    authUserId: state.authUserId,
    nonce: state.nonce,
    issuedAt: state.issuedAt,
  };
}

/** Constant-time comparison for the browser nonce. */
export function sameNonce(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

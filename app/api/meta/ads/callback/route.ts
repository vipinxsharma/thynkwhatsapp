import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { encryptToken } from "@/lib/meta/encryption";
import {
  ADS_NONCE_COOKIE,
  ADS_ROUTE_PREFIX,
  adsRedirectUri,
  sameNonce,
  verifyAdsOAuthState,
} from "@/lib/ads/oauth";
import { exchangeAdsCode, fetchAdAccounts, fetchAdsGrant, revokeAdsRead } from "@/lib/ads/graph";
import { saveAdsConnection } from "@/lib/ads/connection-store";

function finish(request: NextRequest, status: "connected" | "denied" | "invalid_state" | "not_granted" | "failed"): NextResponse {
  const response = NextResponse.redirect(
    new URL(`/growth/ads/connect?status=${status}`, request.nextUrl.origin),
    302,
  );
  // The nonce is single use: clear it whatever the outcome.
  response.cookies.set(ADS_NONCE_COOKIE, "", { path: ADS_ROUTE_PREFIX, maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * Meta redirects here after the login dialog. The state must be signed by this app, unexpired, match
 * the browser nonce and belong to the same workspace and user as the current session. Only then is the
 * code exchanged. The connection is stored only when ads_read was actually granted.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return finish(request, "denied");

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey || !process.env.DATABASE_URL) return finish(request, "failed");

  const state = verifyAdsOAuthState(params.get("state") || "", encryptionKey);
  const nonceCookie = request.cookies.get(ADS_NONCE_COOKIE)?.value;
  if (
    !state ||
    !nonceCookie ||
    !sameNonce(state.nonce, nonceCookie) ||
    state.workspaceId !== auth.session.tenantId ||
    state.authUserId !== auth.session.userId
  ) {
    return finish(request, "invalid_state");
  }

  const code = params.get("code");
  if (!code || code.length > 2000) return finish(request, "failed");

  let accessToken: string | null = null;
  try {
    const exchanged = await exchangeAdsCode({ code, redirectUri: adsRedirectUri(request.nextUrl.origin) });
    accessToken = exchanged.accessToken;
    const grant = await fetchAdsGrant(accessToken);
    if (!grant.adsReadGranted) {
      await revokeAdsRead(accessToken).catch(() => false);
      return finish(request, "not_granted");
    }
    const adAccounts = await fetchAdAccounts(accessToken);
    await saveAdsConnection({
      workspaceId: auth.session.tenantId,
      authUserId: auth.session.userId,
      metaUserId: grant.metaUserId,
      encryptedToken: encryptToken(accessToken),
      tokenExpiresAt: exchanged.expiresIn ? new Date(Date.now() + exchanged.expiresIn * 1000).toISOString() : null,
      adAccounts,
    });
    return finish(request, "connected");
  } catch (error) {
    // Errors here may describe Meta's response but never the token or the secret.
    console.error("[Meta Ads Callback Error]", error instanceof Error ? error.message : "unknown error");
    return finish(request, "failed");
  }
}

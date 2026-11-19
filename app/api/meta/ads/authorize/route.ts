import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import {
  ADS_NONCE_COOKIE,
  ADS_ROUTE_PREFIX,
  ADS_STATE_TTL_MS,
  adsRedirectUri,
  buildAdsConsentUrl,
  signAdsOAuthState,
} from "@/lib/ads/oauth";

/**
 * Starts the ads connection. Only reached from the consent screen's button. Sets a browser-bound
 * nonce and redirects to Meta's login dialog, which asks for ads_read and nothing else.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!appId || !process.env.META_APP_SECRET || !encryptionKey || !process.env.DATABASE_URL) {
    return NextResponse.redirect(new URL("/growth/ads/connect?status=unavailable", request.nextUrl.origin), 302);
  }

  const nonce = crypto.randomBytes(24).toString("base64url");
  const state = signAdsOAuthState(
    {
      workspaceId: auth.session.tenantId,
      authUserId: auth.session.userId,
      nonce,
      issuedAt: Date.now(),
    },
    encryptionKey,
  );

  const response = NextResponse.redirect(
    buildAdsConsentUrl({ appId, redirectUri: adsRedirectUri(request.nextUrl.origin), state }),
    302,
  );
  response.cookies.set(ADS_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: ADS_ROUTE_PREFIX,
    maxAge: Math.floor(ADS_STATE_TTL_MS / 1000),
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

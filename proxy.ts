import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/token";

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/getting-started" ||
    pathname === "/legal" ||
    pathname.startsWith("/legal/") ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/media/") ||
    pathname === "/login" ||
    pathname === "/pricing" ||
    pathname === "/api/billing/webhook" ||
    pathname === "/api/checkout/webhook" ||
    pathname === "/invite" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/webhooks/meta" ||
    pathname === "/api/webhooks/support-email" ||
    // Scheduled job: the route itself requires the CRON_SECRET bearer token.
    pathname === "/api/cron/meta-token-refresh" ||
    pathname === "/api/cron/campaign-send" ||
    pathname === "/api/cron/webhook-deliveries" ||
    // Developer API: each route authenticates a workspace API key itself (lib/developer/api-gateway.ts).
    pathname.startsWith("/api/v1/")
  );
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (isPublicPath(pathname)) return NextResponse.next();

  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  const cookieToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(bearerToken || cookieToken);

  if (session) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

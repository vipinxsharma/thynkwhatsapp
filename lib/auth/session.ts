import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
  type AppRole,
  type AppSession,
} from "@/lib/auth/token";

export {
  SESSION_COOKIE_NAME,
  createSessionToken,
  verifySessionToken,
  type AppRole,
  type AppSession,
} from "@/lib/auth/token";

type ApiAuthResult =
  | { ok: true; session: AppSession }
  | { ok: false; response: NextResponse };

function tokenFromRequest(request: NextRequest): { token?: string; source: "bearer" | "cookie" } {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return { token: authorization.slice(7), source: "bearer" };
  }

  return {
    token: request.cookies.get(SESSION_COOKIE_NAME)?.value,
    source: "cookie",
  };
}

function isSameOriginMutation(request: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  return origin === request.nextUrl.origin;
}

export async function requireApiSession(
  request: NextRequest,
  allowedRoles: AppRole[] = ["owner", "admin", "agent", "viewer"]
): Promise<ApiAuthResult> {
  const { token, source } = tokenFromRequest(request);
  const session = await verifySessionToken(token);

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  if (source === "cookie" && !isSameOriginMutation(request)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid request origin" }, { status: 403 }),
    };
  }

  if (!allowedRoles.includes(session.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }),
    };
  }

  return { ok: true, session };
}

export async function requirePageSession(): Promise<AppSession> {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) redirect("/login");
  return session;
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
  type AppRole,
  type AppSession,
} from "@/lib/auth/token";
import { validateWorkspaceMembership } from "@/lib/workspaces/store";

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
  const signedSession = await verifySessionToken(token);

  if (!signedSession) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  const membership = await validateWorkspaceMembership(signedSession.userId, signedSession.tenantId);
  if (!membership) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Workspace access is no longer active" }, { status: 401 }),
    };
  }
  const session: AppSession = {
    ...signedSession,
    tenantName: membership.workspaceName,
    role: membership.role,
  };

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
  const signedSession = await verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!signedSession) redirect("/login");
  const membership = await validateWorkspaceMembership(signedSession.userId, signedSession.tenantId);
  if (!membership) redirect("/login?error=workspace-access");
  return { ...signedSession, tenantName: membership.workspaceName, role: membership.role };
}

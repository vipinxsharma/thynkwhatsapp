import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { acceptWorkspaceInvitation } from "@/lib/workspaces/team";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  const { token } = await request.json();
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(token || ""))) {
    return NextResponse.json({ error: "A valid invitation token is required" }, { status: 400 });
  }
  const membership = await acceptWorkspaceInvitation({
    token: String(token),
    authUserId: auth.session.userId,
    email: auth.session.email,
  });
  if (!membership) {
    return NextResponse.json({ error: "This invitation is invalid, expired, or belongs to another email" }, { status: 400 });
  }
  const sessionToken = await createSessionToken({
    userId: auth.session.userId,
    email: auth.session.email,
    tenantId: membership.workspaceId,
    tenantName: membership.workspaceName,
    role: membership.role,
  }, "30m");
  const response = NextResponse.json({ success: true, data: membership });
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 60,
  });
  return response;
}

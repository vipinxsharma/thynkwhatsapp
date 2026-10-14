import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { validateWorkspaceMembership } from "@/lib/workspaces/store";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  const { workspaceId } = await request.json();
  const membership = await validateWorkspaceMembership(auth.session.userId, String(workspaceId || ""));
  if (!membership) return NextResponse.json({ error: "Workspace membership not found" }, { status: 404 });
  const sessionToken = await createSessionToken({
    userId: auth.session.userId,
    email: auth.session.email,
    tenantId: membership.workspaceId,
    tenantName: membership.workspaceName,
    role: membership.role,
  }, "30m");
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 60,
  });
  return response;
}

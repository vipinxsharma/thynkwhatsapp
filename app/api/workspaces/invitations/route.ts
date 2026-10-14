import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { createWorkspaceInvitation, isInviteRole } from "@/lib/workspaces/team";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const payload = await request.json();
  const invitedEmail = String(payload.email || "").trim().toLowerCase();
  const role = payload.role;
  if (!/^\S+@\S+\.\S+$/.test(invitedEmail) || !isInviteRole(role)) {
    return NextResponse.json({ error: "A valid email and role are required" }, { status: 400 });
  }
  if (role === "admin" && auth.session.role !== "owner") {
    return NextResponse.json({ error: "Only an owner can invite an administrator" }, { status: 403 });
  }
  let created;
  try {
    created = await createWorkspaceInvitation({
      workspaceId: auth.session.tenantId,
      invitedEmail,
      role,
      invitedByAuthUserId: auth.session.userId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBER_ALREADY_EXISTS") {
      return NextResponse.json({ error: "This email already belongs to an active workspace member" }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({
    success: true,
    data: {
      invitation: created.invitation,
      inviteUrl: `${request.nextUrl.origin}/invite#token=${encodeURIComponent(created.token)}`,
    },
  }, { status: 201 });
}

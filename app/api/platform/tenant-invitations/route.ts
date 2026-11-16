import { NextRequest, NextResponse } from "next/server";
import { requirePlatformApiSuperadmin } from "@/lib/auth/platform-api";
import { createTenantOwnerInvitation, listPendingTenantOwnerInvitations } from "@/lib/workspaces/team";
import { buildTenantInviteUrl, parseTenantInviteInput } from "@/lib/workspaces/tenant-invites";

export async function GET(request: NextRequest) {
  const auth = await requirePlatformApiSuperadmin(request);
  if (!auth.ok) return auth.response;
  const invitations = await listPendingTenantOwnerInvitations();
  return NextResponse.json({ success: true, data: { invitations } });
}

export async function POST(request: NextRequest) {
  const auth = await requirePlatformApiSuperadmin(request);
  if (!auth.ok) return auth.response;
  const input = parseTenantInviteInput(await request.json().catch(() => null));
  if (!input) {
    return NextResponse.json({ error: "A valid email and workspace name are required" }, { status: 400 });
  }
  const created = await createTenantOwnerInvitation({
    workspaceName: input.workspaceName,
    invitedEmail: input.email,
    auditWorkspaceId: auth.session.tenantId,
    createdByAuthUserId: auth.session.userId,
  });
  return NextResponse.json({
    success: true,
    data: {
      invitation: created.invitation,
      inviteUrl: buildTenantInviteUrl(request.nextUrl.origin, created.token),
    },
  }, { status: 201 });
}

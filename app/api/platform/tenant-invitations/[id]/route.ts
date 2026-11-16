import { NextRequest, NextResponse } from "next/server";
import { requirePlatformApiSuperadmin } from "@/lib/auth/platform-api";
import { revokeTenantOwnerInvitation } from "@/lib/workspaces/team";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformApiSuperadmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid invitation id" }, { status: 400 });
  }
  const revoked = await revokeTenantOwnerInvitation({
    invitationId: id,
    auditWorkspaceId: auth.session.tenantId,
    revokedByAuthUserId: auth.session.userId,
  });
  if (!revoked) return NextResponse.json({ error: "Invitation not found or already used" }, { status: 404 });
  return NextResponse.json({ success: true });
}

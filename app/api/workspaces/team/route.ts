import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { listWorkspaceTeam } from "@/lib/workspaces/team";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ success: true, data: await listWorkspaceTeam(auth.session.tenantId) });
}

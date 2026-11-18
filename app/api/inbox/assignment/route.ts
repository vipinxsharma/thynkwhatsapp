import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { assignConversation } from "@/lib/inbox/store";
import { isDurableInboxEnabled } from "@/lib/strapi/client";
import { listWorkspaceTeam } from "@/lib/workspaces/team";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Assignment is a team operation: owners, admins and agents may assign, viewers may not.
export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
  if (!auth.ok) return auth.response;
  if (!isDurableInboxEnabled()) return NextResponse.json({ error: "Durable inbox storage is not configured" }, { status: 503 });

  let body: { conversationId?: unknown; assigneeAuthUserId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.conversationId !== "string" || !uuid.test(body.conversationId)) {
    return NextResponse.json({ error: "Invalid conversation" }, { status: 400 });
  }
  const assignee = body.assigneeAuthUserId === null || body.assigneeAuthUserId === undefined
    ? null : body.assigneeAuthUserId;
  if (assignee !== null && (typeof assignee !== "string" || assignee.length > 200)) {
    return NextResponse.json({ error: "Invalid assignee" }, { status: 400 });
  }
  if (assignee !== null) {
    // The assignee must be an active member of this workspace.
    const { members } = await listWorkspaceTeam(auth.session.tenantId);
    const member = members.find((m) => m.authUserId === assignee && m.status === "active");
    if (!member) return NextResponse.json({ error: "Assignee is not an active member" }, { status: 400 });
  }
  const data = await assignConversation(auth.session.tenantId, auth.session.userId, body.conversationId, assignee);
  return data ? NextResponse.json({ data }) : NextResponse.json({ error: "Conversation not found" }, { status: 404 });
}

import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { isDurableInboxEnabled } from "@/lib/strapi/client";
import { moveLead } from "@/lib/leads/store";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Moves a lead to another stage. Used by the stage board's dropdown and drag-and-drop. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ leadId: string }> }) {
  const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
  if (!auth.ok) return auth.response;
  if (!isDurableInboxEnabled()) {
    return NextResponse.json({ error: "Durable inbox storage is not configured" }, { status: 503 });
  }

  const { leadId } = await context.params;
  if (!uuid.test(leadId)) return NextResponse.json({ error: "Invalid lead" }, { status: 400 });

  let body: { stageId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.stageId !== "string" || !uuid.test(body.stageId)) {
    return NextResponse.json({ error: "stageId must be a stage id" }, { status: 400 });
  }

  const moved = await moveLead(auth.session.tenantId, leadId, body.stageId);
  return moved
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: "Lead or stage not found" }, { status: 404 });
}

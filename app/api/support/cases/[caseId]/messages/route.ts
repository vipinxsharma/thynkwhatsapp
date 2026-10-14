import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { addSupportMessage, listSupportMessages } from "@/lib/support/store";

type Context = { params: Promise<{ caseId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  const { caseId } = await context.params;
  return NextResponse.json({ success: true, data: await listSupportMessages(auth.session.tenantId, caseId) });
}

export async function POST(request: NextRequest, context: Context) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  const { caseId } = await context.params;
  const { body } = await request.json();
  if (!body?.trim()) {
    return NextResponse.json({ error: "A message is required" }, { status: 400 });
  }
  const message = await addSupportMessage({
    workspaceId: auth.session.tenantId,
    caseId,
    senderType: "customer",
    channel: "chat",
    body: String(body).trim().slice(0, 10_000),
  });
  if (!message) return NextResponse.json({ error: "Support case not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: message }, { status: 201 });
}

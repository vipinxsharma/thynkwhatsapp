import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { createSupportCase, listSupportCases } from "@/lib/support/store";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ success: true, data: await listSupportCases(auth.session.tenantId) });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  const { subject, body } = await request.json();
  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
  }
  const created = await createSupportCase({
    workspaceId: auth.session.tenantId,
    authUserId: auth.session.userId,
    requesterEmail: auth.session.email,
    subject: String(subject).trim().slice(0, 200),
    body: String(body).trim().slice(0, 10_000),
    channel: "chat",
  });
  return NextResponse.json({ success: true, data: created }, { status: 201 });
}

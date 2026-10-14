import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { getDltDraft, parseDltDraft, saveDltDraft } from "@/lib/sms/dlt";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "SMS onboarding storage is unavailable" }, { status: 503 });
  return NextResponse.json({ success: true, data: await getDltDraft(auth.session.tenantId) });
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "SMS onboarding storage is unavailable" }, { status: 503 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const input = parseDltDraft(body);
  if (!input) return NextResponse.json({ error: "Invalid DLT draft fields" }, { status: 400 });
  const data = await saveDltDraft(auth.session.tenantId, auth.session.userId, input);
  return NextResponse.json({ success: true, data });
}

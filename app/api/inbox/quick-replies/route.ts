import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { createQuickReply, deleteQuickReply, listQuickReplies } from "@/lib/inbox/store";
import { isDurableInboxEnabled } from "@/lib/strapi/client";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  if (!isDurableInboxEnabled()) return NextResponse.json({ error: "Durable inbox storage is not configured" }, { status: 503 });
  return NextResponse.json({ data: await listQuickReplies(auth.session.tenantId) });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
  if (!auth.ok) return auth.response;
  if (!isDurableInboxEnabled()) return NextResponse.json({ error: "Durable inbox storage is not configured" }, { status: 503 });
  let body: { title?: unknown; body?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!title || title.length > 80 || !text || text.length > 1024) {
    return NextResponse.json({ error: "Title must be 1–80 characters and body 1–1024" }, { status: 400 });
  }
  const reply = await createQuickReply(auth.session.tenantId, auth.session.userId, title, text);
  return NextResponse.json({ data: reply }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  if (!isDurableInboxEnabled()) return NextResponse.json({ error: "Durable inbox storage is not configured" }, { status: 503 });
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!uuid.test(id)) return NextResponse.json({ error: "Invalid quick reply" }, { status: 400 });
  return (await deleteQuickReply(auth.session.tenantId, id))
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: "Quick reply not found" }, { status: 404 });
}

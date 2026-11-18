import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { addNote, listNotes } from "@/lib/inbox/store";
import { isDurableInboxEnabled } from "@/lib/strapi/client";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  if (!isDurableInboxEnabled()) return NextResponse.json({ error: "Durable inbox storage is not configured" }, { status: 503 });
  const conversationId = request.nextUrl.searchParams.get("conversationId") || "";
  if (!uuid.test(conversationId)) return NextResponse.json({ error: "Invalid conversation" }, { status: 400 });
  return NextResponse.json({ data: await listNotes(auth.session.tenantId, conversationId) });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
  if (!auth.ok) return auth.response;
  if (!isDurableInboxEnabled()) return NextResponse.json({ error: "Durable inbox storage is not configured" }, { status: 503 });
  let body: { conversationId?: unknown; body?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (typeof body.conversationId !== "string" || !uuid.test(body.conversationId) || !text || text.length > 2000) {
    return NextResponse.json({ error: "Note must be 1–2000 characters on a valid conversation" }, { status: 400 });
  }
  const note = await addNote(auth.session.tenantId, auth.session.userId, body.conversationId, text);
  return note ? NextResponse.json({ data: note }, { status: 201 }) : NextResponse.json({ error: "Conversation not found" }, { status: 404 });
}

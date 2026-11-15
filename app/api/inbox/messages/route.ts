import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { getConversation, getMessagePage } from "@/lib/inbox/store";
import { isDurableInboxEnabled, StrapiClient } from "@/lib/strapi/client";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const conversationId = params.get("conversationId") || "";
  const beforeTimestamp = params.get("beforeTimestamp");
  const beforeId = params.get("beforeId");
  if (!conversationId || (Boolean(beforeTimestamp) !== Boolean(beforeId))) {
    return NextResponse.json({ error: "Conversation ID and complete cursor are required" }, { status: 400 });
  }

  if (isDurableInboxEnabled()) {
    if (!uuid.test(conversationId) || (beforeId && !uuid.test(beforeId)) ||
        (beforeTimestamp && !Number.isFinite(Date.parse(beforeTimestamp)))) {
      return NextResponse.json({ error: "Invalid conversation or message cursor" }, { status: 400 });
    }
    const conversation = await getConversation(auth.session.tenantId, conversationId);
    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    const page = await getMessagePage(auth.session.tenantId, conversationId,
      beforeTimestamp && beforeId ? { timestamp: beforeTimestamp, id: beforeId } : undefined);
    return NextResponse.json({ data: page });
  }

  // The non-durable adapter remains a development/demo path. Do not serve it in production.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Durable inbox storage is not configured" }, { status: 503 });
  }
  const client = new StrapiClient(auth.session.tenantId);
  const conversations = await client.getConversations();
  if (!conversations.some((item) => String(item.id) === conversationId)) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  const messages = await client.getMessages(conversationId);
  const filtered = beforeTimestamp && beforeId
    ? messages.filter((item) => new Date(item.timestamp).getTime() < Date.parse(beforeTimestamp) ||
      (item.timestamp === beforeTimestamp && String(item.id) < beforeId))
    : messages;
  return NextResponse.json({ data: { messages: filtered.slice(-50), hasMore: filtered.length > 50 } });
}

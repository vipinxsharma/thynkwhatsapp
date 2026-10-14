import { NextRequest, NextResponse } from "next/server";
import { verifyMetaWebhookSignature } from "@/lib/meta/signature";
import { createSupportCaseFromEmail, extractWorkspaceSlug } from "@/lib/support/store";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const secret = process.env.SUPPORT_EMAIL_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Email ingestion is not configured" }, { status: 503 });
  if (!verifyMetaWebhookSignature(rawBody, request.headers.get("x-thynkwise-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid email event" }, { status: 400 });
  }
  const workspaceSlug = extractWorkspaceSlug(String(payload.to || ""));
  if (!workspaceSlug || !payload.from || !payload.subject || !payload.text || !payload.messageId) {
    return NextResponse.json({ error: "Invalid email event" }, { status: 400 });
  }
  const created = await createSupportCaseFromEmail({
    workspaceSlug,
    requesterEmail: String(payload.from).trim().toLowerCase(),
    subject: String(payload.subject).trim().slice(0, 200),
    body: String(payload.text).trim().slice(0, 20_000),
    externalMessageId: String(payload.messageId).slice(0, 500),
  });
  if (!created) return NextResponse.json({ error: "Unknown support address" }, { status: 404 });
  return NextResponse.json({ success: true, caseId: created.id });
}

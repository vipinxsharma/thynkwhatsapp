import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { developerStorageConfigured } from "@/lib/developer/db";
import { rotateWebhookSecret } from "@/lib/developer/webhook-store";

/** Issues a new signing secret. The old secret stops verifying as soon as this returns. */
export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  if (!developerStorageConfigured() || !process.env.ENCRYPTION_KEY) {
    return NextResponse.json({ error: "Webhook signing is not configured on this server" }, { status: 503 });
  }
  const secret = await rotateWebhookSecret({ workspaceId: auth.session.tenantId, authUserId: auth.session.userId });
  return secret
    ? NextResponse.json({ signingSecret: secret }, { headers: { "Cache-Control": "no-store" } })
    : NextResponse.json({ error: "No webhook endpoint is configured" }, { status: 404 });
}

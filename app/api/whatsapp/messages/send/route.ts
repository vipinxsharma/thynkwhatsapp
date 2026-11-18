import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { sendWorkspaceMessage } from "@/lib/messaging/send-message";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const result = await sendWorkspaceMessage({
      workspaceId: auth.session.tenantId,
      actorAuthUserId: auth.session.userId,
      idempotencyKey: request.headers.get("idempotency-key"),
      body,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error: any) {
    console.error("[Send Message Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to send WhatsApp message" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { MetaGraphClient } from "@/lib/meta/client";
import { isDurableInboxEnabled } from "@/lib/strapi/client";
import { requireApiSession } from "@/lib/auth/session";
import { getMetaConnectionForNumber } from "@/lib/meta/connections";
import { getConversation } from "@/lib/inbox/store";
import { isMediaMessageType, safeMediaFilename, validateMediaFile } from "@/lib/inbox/media";
import { evaluateEntitlement, getEntitlementSnapshot } from "@/lib/billing/entitlements";

/**
 * Step one of sending a file: stores it with Meta under the conversation's sender number and returns
 * the media ID. The message itself is sent by POST /api/whatsapp/messages/send, which takes the same
 * Idempotency-Key discipline as every other send, so a retried upload never duplicates a message.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
    if (!auth.ok) return auth.response;
    if (!isDurableInboxEnabled()) {
      return NextResponse.json({ error: "File sending is not available on this deployment" }, { status: 501 });
    }
    if (process.env.NODE_ENV === "production") {
      let access: ReturnType<typeof evaluateEntitlement>;
      try {
        access = evaluateEntitlement(await getEntitlementSnapshot(auth.session.tenantId), "whatsapp_send");
      } catch {
        return NextResponse.json({ error: "Subscription status is temporarily unavailable" }, { status: 503 });
      }
      if (!access.allowed) {
        return NextResponse.json(
          { error: "WhatsApp sending is not active for this workspace", code: access.reason },
          { status: access.reason === "no_subscription" ? 503 : 403 }
        );
      }
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "Send the file as multipart form data" }, { status: 400 });
    }
    const conversationId = form.get("conversationId");
    const messageType = form.get("messageType");
    const file = form.get("file");
    if (typeof conversationId !== "string" || !conversationId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }
    if (!isMediaMessageType(messageType)) {
      return NextResponse.json({ error: "messageType must be image, video or document" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A file is required" }, { status: 400 });
    }
    // Checked before the file is read into a provider request, so an oversize or wrong-type file costs nothing.
    const problem = validateMediaFile(file, messageType);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const conversation = await getConversation(auth.session.tenantId, conversationId);
    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    if (Date.now() > new Date(conversation.windowExpiresAt).getTime()) {
      return NextResponse.json(
        {
          error: "WINDOW_EXPIRED",
          message:
            "The 24-hour customer care window has expired. You must send an approved WhatsApp Template (HSM) to re-engage this customer.",
        },
        { status: 403 }
      );
    }

    const phoneNumberId = conversation.phoneNumber.phoneNumberId;
    if (!phoneNumberId) {
      return NextResponse.json({ error: "Conversation has no verified sender number. Reassign it before sending." }, { status: 409 });
    }
    const connection = await getMetaConnectionForNumber(auth.session.tenantId, phoneNumberId);
    if (!connection) return NextResponse.json({ error: "This conversation's WhatsApp channel is not connected" }, { status: 409 });

    const filename = safeMediaFilename(file.name, messageType);
    const uploaded = await new MetaGraphClient(connection.accessToken).uploadMedia(phoneNumberId, {
      bytes: file,
      mimeType: file.type,
      filename,
    });
    return NextResponse.json({
      success: true,
      data: { mediaId: uploaded.id, messageType, mimeType: file.type, filename },
    });
  } catch (error: any) {
    console.error("[Media Upload Error]", error);
    return NextResponse.json({ error: error.message || "Failed to upload the file" }, { status: 500 });
  }
}

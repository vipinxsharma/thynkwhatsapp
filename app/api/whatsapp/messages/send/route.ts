import { NextRequest, NextResponse } from "next/server";
import { MetaGraphClient } from "@/lib/meta/client";
import { StrapiClient, isDurableInboxEnabled } from "@/lib/strapi/client";
import { MetaSendMessagePayload } from "@/types/meta-api";
import { requireApiSession } from "@/lib/auth/session";
import { getMetaConnectionForWorkspace, getMetaConnectionForNumber } from "@/lib/meta/connections";
import { getConversation } from "@/lib/inbox/store";
import { evaluateEntitlement, getEntitlementSnapshot } from "@/lib/billing/entitlements";
import {
  acceptOutboundRequest,
  beginOutboundRequest,
  getAcceptedMessage,
  hashOutboundRequest,
  markOutboundUncertain,
} from "@/lib/outbound/store";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
    if (!auth.ok) return auth.response;
    const durable = isDurableInboxEnabled();
    if (process.env.NODE_ENV === "production" && !durable) {
      return NextResponse.json({ error: "Durable outbound delivery is not configured" }, { status: 503 });
    }
    if (process.env.NODE_ENV === "production") {
      let access: ReturnType<typeof evaluateEntitlement>;
      try {
        access = evaluateEntitlement(
          await getEntitlementSnapshot(auth.session.tenantId),
          "whatsapp_send"
        );
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
    const strapiClient = new StrapiClient(auth.session.tenantId);

    const body = await request.json();
    const {
      conversationId,
      recipientPhone,
      messageType = "text",
      text,
      templateName,
      templateLanguage = "en_US",
      templateVariables = [],
      mediaUrl,
      caption,
      filename,
      interactiveButtons = [],
    } = body;

    if (!conversationId || !recipientPhone) {
      return NextResponse.json(
        { error: "Missing required fields: conversationId, recipientPhone" },
        { status: 400 }
      );
    }
    if (durable && !["text", "template"].includes(messageType)) {
      return NextResponse.json({ error: "This message type is not yet available for live delivery" }, { status: 501 });
    }
    if (messageType === "text" && (typeof text !== "string" || !text.trim())) {
      return NextResponse.json({ error: "Message text is required" }, { status: 400 });
    }
    if (messageType === "template" && (!templateName || typeof templateName !== "string")) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }

    // 1. Check conversation and 24-Hour Customer Care Window
    const conversation = durable
      ? await getConversation(auth.session.tenantId, String(conversationId))
      : (await strapiClient.getConversations()).find((c) => String(c.id) === String(conversationId));

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const windowExpires = new Date(conversation.windowExpiresAt).getTime();
    const isWindowExpired = Date.now() > windowExpires;

    // Rule: Outside 24h window, business MUST send an approved template
    if (isWindowExpired && messageType !== "template") {
      return NextResponse.json(
        {
          error: "WINDOW_EXPIRED",
          message:
            "The 24-hour customer care window has expired. You must send an approved WhatsApp Template (HSM) to re-engage this customer.",
        },
        { status: 403 }
      );
    }

    // 2. Build Meta Cloud API payload
    const normalizedPhone = recipientPhone.replace(/\D/g, "");
    if (normalizedPhone !== conversation.contact.waId.replace(/\D/g, "")) {
      return NextResponse.json(
        { error: "Recipient does not match the selected tenant conversation" },
        { status: 403 }
      );
    }
    let metaPayload: MetaSendMessagePayload;
    let savedBody = text || "";

    if (messageType === "template") {
      savedBody = `[Template: ${templateName}]`;
      metaPayload = {
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components:
            templateVariables.length > 0
              ? [
                  {
                    type: "body",
                    parameters: templateVariables.map((val: string) => ({
                      type: "text",
                      text: val,
                    })),
                  },
                ]
              : undefined,
        },
      };
    } else if (messageType === "image") {
      savedBody = caption ? `${caption}` : "[Image Attachment]";
      metaPayload = {
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "image",
        image: {
          link: mediaUrl,
          caption: caption || undefined,
        },
      };
    } else if (messageType === "document") {
      savedBody = filename ? `[Document: ${filename}] ${caption || ""}` : (caption || "[Document Attachment]");
      metaPayload = {
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "document",
        document: {
          link: mediaUrl,
          filename: filename || "document.pdf",
          caption: caption || undefined,
        },
      };
    } else if (messageType === "interactive") {
      savedBody = text || "Choose an option:";
      metaPayload = {
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text: savedBody,
          },
          action: {
            buttons: (interactiveButtons.length > 0
              ? interactiveButtons
              : [
                  { id: "opt_1", title: "Interested" },
                  { id: "opt_2", title: "Schedule Demo" },
                ]
            ).map((btn: any) => ({
              type: "reply",
              reply: {
                id: btn.id || `btn_${Date.now()}`,
                title: btn.title || btn.text || "Option",
              },
            })),
          },
        },
      };
    } else {
      metaPayload = {
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "text",
        text: { body: text },
      };
    }

    // 3. Reserve the operation before the irreversible provider call.
    if (durable && !conversation.phoneNumber.phoneNumberId) {
      return NextResponse.json({ error: "Conversation has no verified sender number. Reassign it before sending." }, { status: 409 });
    }
    const connection = durable && conversation.phoneNumber.phoneNumberId
      ? await getMetaConnectionForNumber(auth.session.tenantId, conversation.phoneNumber.phoneNumberId)
      : await getMetaConnectionForWorkspace(auth.session.tenantId);
    if (!connection) return NextResponse.json({ error: "This conversation's WhatsApp channel is not connected" }, { status: 409 });
    const metaClient = new MetaGraphClient(connection.accessToken);
    if (durable && conversation.phoneNumber.phoneNumberId &&
        conversation.phoneNumber.phoneNumberId !== connection.phoneNumberId) {
      return NextResponse.json({ error: "Conversation belongs to another WhatsApp number" }, { status: 403 });
    }
    if (durable && messageType === "template") {
      const approved = (await metaClient.getTemplates(connection.wabaId)).some(
        (item) => item.name === templateName && item.language === templateLanguage && item.status === "APPROVED"
      );
      if (!approved) return NextResponse.json({ error: "Template is not approved for this WABA and language" }, { status: 403 });
    }

    let reserved: Awaited<ReturnType<typeof beginOutboundRequest>> | null = null;
    if (durable) {
      const idempotencyKey = request.headers.get("idempotency-key");
      if (!idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
        return NextResponse.json({ error: "A UUID Idempotency-Key header is required" }, { status: 400 });
      }
      const requestHash = hashOutboundRequest({
        conversationId: String(conversationId), phoneNumberId: connection.phoneNumberId,
        recipientWaId: normalizedPhone, payload: metaPayload,
      });
      reserved = await beginOutboundRequest({
        workspaceId: auth.session.tenantId,
        conversationId: String(conversationId),
        idempotencyKey,
        requestHash,
        authUserId: auth.session.userId,
        phoneNumberId: connection.phoneNumberId,
        recipientWaId: normalizedPhone,
        messageType,
        messageBody: savedBody,
        payload: metaPayload,
      });
      if (reserved.requestHash !== requestHash) {
        return NextResponse.json({ error: "Idempotency key was already used for a different message" }, { status: 409 });
      }
      if (!reserved.createdNew) {
        const existing = reserved.wamId && reserved.status === "accepted"
          ? await getAcceptedMessage(auth.session.tenantId, reserved.wamId) : null;
        if (existing) return NextResponse.json({ success: true, data: existing });
        return NextResponse.json({
          success: false, status: reserved.status,
          error: "This request has already been submitted. Its outcome is pending reconciliation; do not resend it with a new key.",
        }, { status: 202 });
      }
    }

    let wamId: string;
    try {
      const metaResponse = await metaClient.sendMessage(connection.phoneNumberId, metaPayload);
      const providerId = metaResponse.messages[0]?.id;
      if (!providerId) throw new Error("Meta did not return a message ID");
      wamId = providerId;
      if (reserved) {
        const recordedMessage = await acceptOutboundRequest({
          workspaceId: auth.session.tenantId, requestId: reserved.id, wamId,
        });
        return NextResponse.json({ success: true, data: recordedMessage });
      }
    } catch (error) {
      if (reserved) {
        try { await markOutboundUncertain(auth.session.tenantId, reserved.id); }
        catch (ledgerError) { console.error("[Outbound Ledger Error]", ledgerError); }
        return NextResponse.json({
          success: false, status: "uncertain",
          error: "The provider outcome is uncertain. Do not resend with a new request ID; contact support for reconciliation.",
        }, { status: 202 });
      }
      throw error;
    }

    // Development demo path only. Production always uses the durable ledger above.
    const recordedMessage = await strapiClient.recordMessage(conversationId, {
      wamId,
      direction: "outbound",
      type: messageType,
      body: savedBody,
      rawPayload: {
        ...metaPayload,
        mediaUrl,
        filename,
      },
      status: "sent",
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: recordedMessage,
    });
  } catch (error: any) {
    console.error("[Send Message Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to send WhatsApp message" },
      { status: 500 }
    );
  }
}

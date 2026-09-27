import { NextRequest, NextResponse } from "next/server";
import { MetaGraphClient } from "@/lib/meta/client";
import { StrapiClient } from "@/lib/strapi/client";
import { MetaSendMessagePayload } from "@/types/meta-api";

const strapiClient = new StrapiClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      conversationId,
      recipientPhone,
      phoneNumberId,
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

    if (!conversationId || !recipientPhone || !phoneNumberId) {
      return NextResponse.json(
        { error: "Missing required fields: conversationId, recipientPhone, phoneNumberId" },
        { status: 400 }
      );
    }

    // 1. Check conversation and 24-Hour Customer Care Window
    const conversations = await strapiClient.getConversations();
    const conversation = conversations.find((c) => String(c.id) === String(conversationId));

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

    // 3. Dispatch to Meta Cloud API
    const metaClient = new MetaGraphClient();
    const metaResponse = await metaClient.sendMessage(phoneNumberId, metaPayload);
    const wamId = metaResponse.messages[0]?.id || `wamid.LOCAL_${Date.now()}`;

    // 4. Save to Strapi
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

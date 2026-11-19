import { MetaGraphClient } from "@/lib/meta/client";
import { StrapiClient, isDurableInboxEnabled } from "@/lib/strapi/client";
import { MetaSendMessagePayload } from "@/types/meta-api";
import { getMetaConnectionForWorkspace, getMetaConnectionForNumber } from "@/lib/meta/connections";
import { getConversation } from "@/lib/inbox/store";
import { MAX_MEDIA_CAPTION_LENGTH, isMediaMessageType, safeMediaFilename } from "@/lib/inbox/media";
import { evaluateEntitlement, getEntitlementSnapshot } from "@/lib/billing/entitlements";
import { checkProductMessageEligibility, type EligibleProduct } from "@/lib/catalog/eligibility";
import {
  acceptOutboundRequest,
  beginOutboundRequest,
  getAcceptedMessage,
  hashOutboundRequest,
  markOutboundUncertain,
} from "@/lib/outbound/store";

/**
 * The one send path for WhatsApp messages. The dashboard route and the public developer API both
 * call it, so the 24-hour window, template approval, entitlement and the idempotent outbound ledger
 * apply to every caller.
 */

export interface SendMessageResult {
  status: number;
  body: Record<string, unknown>;
}

export interface SendMessageInput {
  workspaceId: string;
  /** Auth user id for the dashboard, or a `api_key:<id>` actor for the developer API. */
  actorAuthUserId: string;
  /** Value of the Idempotency-Key header. Required on the durable path. */
  idempotencyKey: string | null;
  /** Same field names as the dashboard send request body. */
  body: Record<string, any>;
}

export async function sendWorkspaceMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const workspaceId = input.workspaceId;
  const durable = isDurableInboxEnabled();
  if (process.env.NODE_ENV === "production" && !durable) {
    return { status: 503, body: { error: "Durable outbound delivery is not configured" } };
  }
  if (process.env.NODE_ENV === "production") {
    let access: ReturnType<typeof evaluateEntitlement>;
    try {
      access = evaluateEntitlement(await getEntitlementSnapshot(workspaceId), "whatsapp_send");
    } catch {
      return { status: 503, body: { error: "Subscription status is temporarily unavailable" } };
    }
    if (!access.allowed) {
      return {
        status: access.reason === "no_subscription" ? 503 : 403,
        body: { error: "WhatsApp sending is not active for this workspace", code: access.reason },
      };
    }
  }
  const strapiClient = new StrapiClient(workspaceId);

  const body = input.body;
  const {
    conversationId,
    recipientPhone,
    messageType = "text",
    text,
    templateName,
    templateLanguage = "en_US",
    templateVariables = [],
    mediaUrl,
    mediaId,
    caption,
    filename,
    interactiveButtons = [],
    productId,
  } = body;

  if (!conversationId || !recipientPhone) {
    return { status: 400, body: { error: "Missing required fields: conversationId, recipientPhone" } };
  }
  if (durable && !["text", "template", "image", "video", "document", "product"].includes(messageType)) {
    return { status: 501, body: { error: "This message type is not yet available for live delivery" } };
  }
  if (messageType === "text" && (typeof text !== "string" || !text.trim())) {
    return { status: 400, body: { error: "Message text is required" } };
  }
  if (messageType === "template" && (!templateName || typeof templateName !== "string")) {
    return { status: 400, body: { error: "Template name is required" } };
  }
  const isMedia = isMediaMessageType(messageType);
  if (isMedia && caption !== undefined && (typeof caption !== "string" || caption.length > MAX_MEDIA_CAPTION_LENGTH)) {
    return { status: 400, body: { error: `Captions must be text of ${MAX_MEDIA_CAPTION_LENGTH} characters or fewer` } };
  }
  if (isMedia && durable && (typeof mediaId !== "string" || !/^\d{5,30}$/.test(mediaId))) {
    return { status: 400, body: { error: "Upload the file first; a media ID is required" } };
  }

  // 1. Check conversation and 24-Hour Customer Care Window
  const conversation = durable
    ? await getConversation(workspaceId, String(conversationId))
    : (await strapiClient.getConversations()).find((c) => String(c.id) === String(conversationId));

  if (!conversation) {
    return { status: 404, body: { error: "Conversation not found" } };
  }

  const windowExpires = new Date(conversation.windowExpiresAt).getTime();
  const isWindowExpired = Date.now() > windowExpires;

  // Rule: Outside 24h window, business MUST send an approved template
  if (isWindowExpired && messageType !== "template") {
    return {
      status: 403,
      body: {
        error: "WINDOW_EXPIRED",
        message:
          "The 24-hour customer care window has expired. You must send an approved WhatsApp Template (HSM) to re-engage this customer.",
      },
    };
  }

  // 2. Build Meta Cloud API payload
  const normalizedPhone = recipientPhone.replace(/\D/g, "");
  if (normalizedPhone !== conversation.contact.waId.replace(/\D/g, "")) {
    return { status: 403, body: { error: "Recipient does not match the selected tenant conversation" } };
  }
  // Product messages are checked against the catalogue sync state before any payload is built.
  let productEligibility: EligibleProduct | null = null;
  if (messageType === "product") {
    if (!durable) return { status: 501, body: { error: "Catalogue messages need the durable outbound path" } };
    if (typeof text === "string" && text.length > 1024) {
      return { status: 400, body: { error: "Catalogue message text must be 1024 characters or fewer" } };
    }
    const eligibility = await checkProductMessageEligibility(workspaceId, String(productId ?? ""));
    if (!eligibility.eligible) {
      return { status: 409, body: { error: eligibility.message, code: eligibility.reason } };
    }
    productEligibility = eligibility;
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
        ...(durable ? { id: mediaId } : { link: mediaUrl }),
        caption: caption || undefined,
      },
    };
  } else if (messageType === "video") {
    savedBody = caption ? `${caption}` : "[Video Attachment]";
    metaPayload = {
      messaging_product: "whatsapp",
      to: normalizedPhone,
      type: "video",
      video: {
        ...(durable ? { id: mediaId } : { link: mediaUrl }),
        caption: caption || undefined,
      },
    };
  } else if (messageType === "document") {
    const displayName = safeMediaFilename(filename, "document.pdf");
    savedBody = `[Document: ${displayName}] ${caption || ""}`.trimEnd();
    metaPayload = {
      messaging_product: "whatsapp",
      to: normalizedPhone,
      type: "document",
      document: {
        ...(durable ? { id: mediaId } : { link: mediaUrl }),
        filename: displayName,
        caption: caption || undefined,
      },
    };
  } else if (productEligibility) {
    const productText = typeof text === "string" && text.trim() ? text.trim() : productEligibility.productName;
    savedBody = productText;
    metaPayload = {
      messaging_product: "whatsapp",
      to: normalizedPhone,
      type: "interactive",
      interactive: {
        type: "product",
        body: { text: productText },
        action: {
          catalog_id: productEligibility.catalogId,
          product_retailer_id: productEligibility.retailerId,
        },
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
    return {
      status: 409,
      body: { error: "Conversation has no verified sender number. Reassign it before sending." },
    };
  }
  const connection = durable && conversation.phoneNumber.phoneNumberId
    ? await getMetaConnectionForNumber(workspaceId, conversation.phoneNumber.phoneNumberId)
    : await getMetaConnectionForWorkspace(workspaceId);
  if (!connection) {
    return { status: 409, body: { error: "This conversation's WhatsApp channel is not connected" } };
  }
  const metaClient = new MetaGraphClient(connection.accessToken);
  if (durable && conversation.phoneNumber.phoneNumberId &&
      conversation.phoneNumber.phoneNumberId !== connection.phoneNumberId) {
    return { status: 403, body: { error: "Conversation belongs to another WhatsApp number" } };
  }
  // The catalogue must be linked to the WABA that is sending. Checked before the provider call.
  if (productEligibility && productEligibility.linkedWabaId !== connection.wabaId) {
    return {
      status: 409,
      body: { error: "This catalogue is linked to a different WhatsApp account than the sender", code: "catalog_waba_mismatch" },
    };
  }
  if (durable && messageType === "template") {
    const approved = (await metaClient.getTemplates(connection.wabaId)).some(
      (item) => item.name === templateName && item.language === templateLanguage && item.status === "APPROVED"
    );
    if (!approved) return { status: 403, body: { error: "Template is not approved for this WABA and language" } };
  }

  let reserved: Awaited<ReturnType<typeof beginOutboundRequest>> | null = null;
  if (durable) {
    const idempotencyKey = input.idempotencyKey;
    if (!idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
      return { status: 400, body: { error: "A UUID Idempotency-Key header is required" } };
    }
    const requestHash = hashOutboundRequest({
      conversationId: String(conversationId), phoneNumberId: connection.phoneNumberId,
      recipientWaId: normalizedPhone, payload: metaPayload,
    });
    reserved = await beginOutboundRequest({
      workspaceId,
      conversationId: String(conversationId),
      idempotencyKey,
      requestHash,
      authUserId: input.actorAuthUserId,
      phoneNumberId: connection.phoneNumberId,
      recipientWaId: normalizedPhone,
      messageType,
      messageBody: savedBody,
      payload: metaPayload,
    });
    if (reserved.requestHash !== requestHash) {
      return { status: 409, body: { error: "Idempotency key was already used for a different message" } };
    }
    if (!reserved.createdNew) {
      const existing = reserved.wamId && reserved.status === "accepted"
        ? await getAcceptedMessage(workspaceId, reserved.wamId) : null;
      if (existing) return { status: 200, body: { success: true, data: existing } };
      return {
        status: 202,
        body: {
          success: false, status: reserved.status,
          error: "This request has already been submitted. Its outcome is pending reconciliation; do not resend it with a new key.",
        },
      };
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
        workspaceId, requestId: reserved.id, wamId,
      });
      return { status: 200, body: { success: true, data: recordedMessage } };
    }
  } catch (error) {
    if (reserved) {
      try { await markOutboundUncertain(workspaceId, reserved.id); }
      catch (ledgerError) { console.error("[Outbound Ledger Error]", ledgerError); }
      return {
        status: 202,
        body: {
          success: false, status: "uncertain",
          error: "The provider outcome is uncertain. Do not resend with a new request ID; contact support for reconciliation.",
        },
      };
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

  return { status: 200, body: { success: true, data: recordedMessage } };
}

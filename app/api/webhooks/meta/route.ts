import { NextRequest, NextResponse } from "next/server";
import { verifyMetaWebhookSignature } from "@/lib/meta/signature";
import { MetaWebhookPayload, WebhookChangeValue } from "@/types/meta-webhook";
import { StrapiClient, isDurableInboxEnabled } from "@/lib/strapi/client";
import { emitMessageStatusUpdate, emitNewInboundMessage } from "@/lib/events/emitter";
import { getMetaConnectionForWaba } from "@/lib/meta/connections";
import { getConversationForSender } from "@/lib/inbox/store";

/**
 * 1. GET: Webhook Challenge Verification
 * Meta's servers invoke this when configuring or verifying the webhook URL in the Meta App Dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!mode || !token) {
    return new NextResponse("Missing query parameters", { status: 400 });
  }

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) {
    return new NextResponse("Webhook verification is not configured", { status: 503 });
  }

  if (mode === "subscribe" && token === verifyToken) {
    // Meta requires plain text response with HTTP 200 containing the exact challenge value
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  return new NextResponse("Forbidden: Invalid verification token", { status: 403 });
}

/**
 * 2. POST: Meta Event Notification Handler
 * Receives messages, status delivery receipts, and template approval updates.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-hub-signature-256");

    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      return NextResponse.json({ error: "Webhook signing is not configured" }, { status: 503 });
    }

    const isValid = verifyMetaWebhookSignature(rawBody, signatureHeader, appSecret);
    if (!isValid) {
      console.warn("[Meta Webhook] Invalid HMAC-SHA256 signature rejected.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (process.env.NODE_ENV === "production" && !isDurableInboxEnabled()) {
      return NextResponse.json({ error: "Durable inbox storage is not configured" }, { status: 503 });
    }

    const payload: MetaWebhookPayload = JSON.parse(rawBody);

    // Filter for WhatsApp Business Account notifications
    if (payload.object !== "whatsapp_business_account") {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // Acknowledge only after ingestion succeeds. A detached promise can be lost when
    // the request's serverless invocation ends, with no opportunity for a retry.
    await processWebhookEntries(payload.entry);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("[Meta Webhook Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * Parses and ingests messages, statuses, and template notifications
 */
async function processWebhookEntries(entries: MetaWebhookPayload["entry"]) {
  if (!entries || !Array.isArray(entries)) return;

  for (const entry of entries) {
    const wabaId = entry.id;
    for (const change of entry.changes || []) {
      const value: WebhookChangeValue = change.value;
      if (!value) continue;

      // Handle message events
      if (change.field === "messages") {
        const metadata = value.metadata;
        const phoneNumberId = metadata?.phone_number_id;
        const connection = phoneNumberId ? await getMetaConnectionForWaba(wabaId, phoneNumberId) : null;
        if (!connection) {
          console.warn(`[Meta Webhook] No active channel mapping for WABA ${wabaId}`);
          continue;
        }
        const tenantId = connection.workspaceId;
        const strapiClient = new StrapiClient(tenantId);

        // 1. Process Message Status Updates (sent, delivered, read, failed)
        if (value.statuses && Array.isArray(value.statuses)) {
          for (const statusUpdate of value.statuses) {
            await strapiClient.updateMessageStatus(statusUpdate.id, statusUpdate.status);
            emitMessageStatusUpdate(tenantId, statusUpdate.id, statusUpdate.status);
            console.log(
              `[Webhook Status] Message ${statusUpdate.id} status updated to: ${statusUpdate.status}`
            );
          }
        }

        // 2. Process Inbound Messages
        if (value.messages && Array.isArray(value.messages)) {
          const contactProfile = value.contacts?.[0];

          for (const msg of value.messages) {
            let bodyText = "";
            if (msg.type === "text" && msg.text) {
              bodyText = msg.text.body;
            } else if (msg.type === "interactive" && msg.interactive) {
              bodyText =
                msg.interactive.button_reply?.title ||
                msg.interactive.list_reply?.title ||
                "[Interactive Response]";
            } else if (["image", "video", "audio", "document"].includes(msg.type)) {
              bodyText = (msg as any)[msg.type]?.caption || `[Attachment: ${msg.type}]`;
            } else {
              bodyText = `[${msg.type}]`;
            }

            // Never attach a new sender's message to an unrelated conversation.
            const matched = isDurableInboxEnabled()
              ? await getConversationForSender(tenantId, msg.from, connection.phoneNumberId)
              : (await strapiClient.getConversations()).find((c) => c.contact.waId === msg.from &&
                c.phoneNumber.phoneNumberId === connection.phoneNumberId);
            let matchedConv = matched || undefined;
            if (!matchedConv) {
              const created = await strapiClient.createContact({
                name: value.contacts?.find((contact) => contact.wa_id === msg.from)?.profile.name || msg.from,
                phoneNumber: `+${msg.from}`,
                tags: [],
                inbound: true,
                connectedPhone: {
                  id: connection.phoneNumberId,
                  phoneNumberId: connection.phoneNumberId,
                  displayPhoneNumber: connection.displayPhoneNumber || metadata?.display_phone_number || "",
                  verifiedName: connection.verifiedName || "",
                  qualityRating: "UNKNOWN",
                  codeVerificationStatus: "NOT_VERIFIED",
                },
              });
              matchedConv = created.conversation;
            }

            if (matchedConv) {
              const recorded = await strapiClient.recordMessage(matchedConv.id, {
                wamId: msg.id,
                direction: "inbound",
                type: msg.type as any,
                body: bodyText,
                rawPayload: msg,
                status: "received",
                timestamp: new Date(parseInt(msg.timestamp, 10) * 1000).toISOString(),
              });
              emitNewInboundMessage(tenantId, matchedConv.id, recorded);
              console.log(
                `[Webhook Inbound Message] Ingested message ${msg.id} from ${msg.from} to conversation ${matchedConv.id}`
              );

            }
          }
        }
      }

      // Handle template approval / rejection status updates
      if (change.field === "message_template_status_update") {
        console.log(
          `[Webhook Template Update] Template ${value.message_template_name} (${value.message_template_id}) status: ${value.event}, reason: ${value.reason}`
        );
      }
    }
  }
}

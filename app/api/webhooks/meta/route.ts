import { NextRequest, NextResponse } from "next/server";
import { verifyMetaWebhookSignature } from "@/lib/meta/signature";
import { MetaWebhookPayload, WebhookChangeValue } from "@/types/meta-webhook";
import { StrapiClient } from "@/lib/strapi/client";
import { emitMessageStatusUpdate, emitNewInboundMessage } from "@/lib/events/emitter";

const META_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || "thynkwise_meta_verify_token_secure_2026";
const strapiClient = new StrapiClient();

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

  if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
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

    // In production or when META_APP_SECRET is set, enforce HMAC-SHA256 signature verification
    const appSecret = process.env.META_APP_SECRET;
    if (appSecret) {
      const isValid = verifyMetaWebhookSignature(rawBody, signatureHeader, appSecret);
      if (!isValid) {
        console.warn("[Meta Webhook] Invalid HMAC-SHA256 signature rejected.");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload: MetaWebhookPayload = JSON.parse(rawBody);

    // Filter for WhatsApp Business Account notifications
    if (payload.object !== "whatsapp_business_account") {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // Process entries asynchronously so response returns quickly within Meta's 3-5 second SLA
    processWebhookEntries(payload.entry).catch((err) => {
      console.error("[Meta Webhook Processing Error]", err);
    });

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

        // 1. Process Message Status Updates (sent, delivered, read, failed)
        if (value.statuses && Array.isArray(value.statuses)) {
          for (const statusUpdate of value.statuses) {
            await strapiClient.updateMessageStatus(statusUpdate.id, statusUpdate.status);
            emitMessageStatusUpdate(statusUpdate.id, statusUpdate.status);
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

            // Find matching conversation or default to active conversation (for demo/standalone)
            const conversations = await strapiClient.getConversations();
            const matchedConv =
              conversations.find((c) => c.contact.waId === msg.from) || conversations[0];

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
              emitNewInboundMessage(matchedConv.id, recorded);
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

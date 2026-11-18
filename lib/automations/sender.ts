import { MetaGraphClient } from "@/lib/meta/client";
import { getMetaConnectionForNumber } from "@/lib/meta/connections";
import { getConversation } from "@/lib/inbox/store";
import {
  acceptOutboundRequest,
  beginOutboundRequest,
  hashOutboundRequest,
  markOutboundUncertain,
} from "@/lib/outbound/store";
import type { MetaSendMessagePayload } from "@/types/meta-api";
import { chooseReplyMode, deterministicUuid, type ReplyCandidates } from "./reply";

/**
 * Server-side sends for automations (rule replies, handover and holding messages). These
 * have no user session, so they use the durable outbound ledger with a deterministic
 * idempotency key: a retried webhook reuses the same ledger row and cannot send twice.
 */

export type AutomatedSendOutcome =
  | "sent"
  | "already_sent"
  | "pending_reconciliation"
  | "skipped:window_closed"
  | "skipped:no_reply_configured"
  | "skipped:template_not_approved"
  | "failed";

async function sendOnce(input: {
  workspaceId: string;
  conversationId: string;
  phoneNumberId: string;
  waId: string;
  seed: string;
  payload: MetaSendMessagePayload;
  body: string;
  type: "text" | "template";
  actor: string;
}): Promise<"sent" | "already_sent" | "pending_reconciliation"> {
  const connection = await getMetaConnectionForNumber(input.workspaceId, input.phoneNumberId);
  if (!connection) throw new Error("The conversation's WhatsApp channel is not connected");
  const client = new MetaGraphClient(connection.accessToken);
  const requestHash = hashOutboundRequest({
    conversationId: input.conversationId, phoneNumberId: input.phoneNumberId,
    recipientWaId: input.waId, payload: input.payload,
  });
  const reserved = await beginOutboundRequest({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    idempotencyKey: deterministicUuid(input.seed),
    requestHash,
    authUserId: input.actor,
    phoneNumberId: input.phoneNumberId,
    recipientWaId: input.waId,
    messageType: input.type,
    messageBody: input.body,
    payload: input.payload,
  });
  if (!reserved.createdNew) return reserved.wamId ? "already_sent" : "pending_reconciliation";
  try {
    const response = await client.sendMessage(input.phoneNumberId, input.payload);
    const wamId = response.messages[0]?.id;
    if (!wamId) throw new Error("Meta did not return a message ID");
    await acceptOutboundRequest({ workspaceId: input.workspaceId, requestId: reserved.id, wamId });
    return "sent";
  } catch (error) {
    try { await markOutboundUncertain(input.workspaceId, reserved.id); }
    catch (ledgerError) { console.error("[Automation Ledger Error]", ledgerError); }
    throw error;
  }
}

/** Free-text send inside the 24-hour window only. Used for handover and holding messages. */
export async function sendFreeTextInWindow(input: {
  workspaceId: string;
  conversationId: string;
  phoneNumberId: string;
  waId: string;
  text: string;
  seed: string;
  actor: string;
}): Promise<AutomatedSendOutcome> {
  const conversation = await getConversation(input.workspaceId, input.conversationId);
  if (!conversation) return "failed";
  if (Date.now() > new Date(conversation.windowExpiresAt).getTime()) return "skipped:window_closed";
  try {
    return await sendOnce({
      workspaceId: input.workspaceId, conversationId: input.conversationId,
      phoneNumberId: input.phoneNumberId, waId: input.waId, seed: input.seed, type: "text", body: input.text,
      actor: input.actor,
      payload: { messaging_product: "whatsapp", to: input.waId, type: "text", text: { body: input.text } },
    });
  } catch (error) {
    console.error("[Automation Send Error]", error);
    return "failed";
  }
}

/**
 * Sends a rule reply. Text is used inside the 24-hour window. An approved template is used
 * outside it, or inside it when no text is configured. Anything else is skipped and recorded.
 */
export async function sendRuleReply(input: {
  workspaceId: string;
  conversationId: string;
  phoneNumberId: string;
  waId: string;
  runId: string;
  candidates: ReplyCandidates;
  actor: string;
}): Promise<AutomatedSendOutcome> {
  const conversation = await getConversation(input.workspaceId, input.conversationId);
  if (!conversation) return "failed";
  const windowOpen = Date.now() <= new Date(conversation.windowExpiresAt).getTime();
  const mode = chooseReplyMode(input.candidates, windowOpen);
  if (mode.mode === "skip") return `skipped:${mode.reason}` as AutomatedSendOutcome;

  try {
    if (mode.mode === "text") {
      return await sendOnce({
        workspaceId: input.workspaceId, conversationId: input.conversationId,
        phoneNumberId: input.phoneNumberId, waId: input.waId, seed: `automation:${input.runId}`,
        type: "text", body: mode.text, actor: input.actor,
        payload: { messaging_product: "whatsapp", to: input.waId, type: "text", text: { body: mode.text } },
      });
    }

    const connection = await getMetaConnectionForNumber(input.workspaceId, input.phoneNumberId);
    if (!connection) return "failed";
    const templates = await new MetaGraphClient(connection.accessToken).getTemplates(connection.wabaId);
    const approved = templates.some((item) => item.name === mode.name && item.language === mode.language && item.status === "APPROVED");
    if (!approved) return "skipped:template_not_approved";

    const body = `[Template: ${mode.name}]`;
    return await sendOnce({
      workspaceId: input.workspaceId, conversationId: input.conversationId,
      phoneNumberId: input.phoneNumberId, waId: input.waId, seed: `automation:${input.runId}`,
      type: "template", body, actor: input.actor,
      payload: {
        messaging_product: "whatsapp", to: input.waId, type: "template",
        template: {
          name: mode.name,
          language: { code: mode.language },
          components: mode.variables.length
            ? [{ type: "body", parameters: mode.variables.map((value) => ({ type: "text", text: value })) }]
            : undefined,
        },
      } as MetaSendMessagePayload,
    });
  } catch (error) {
    console.error("[Automation Reply Error]", error);
    return "failed";
  }
}

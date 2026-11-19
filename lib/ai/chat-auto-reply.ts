import { getConversation } from "@/lib/inbox/store";
import { sendFreeTextInWindow } from "@/lib/automations/sender";
import { getSenderFlags, handOverConversation, recordInboundOptOut } from "@/lib/chat-settings/store";
import { decideReply, isOptOutText, parseFaqText, type ReplyDecision } from "./chat";
import { decideWithModel } from "./chat-model";
import { getAiChatSettings, loadCatalogueHits, ruleReplyExistsForMessage } from "./chat-store";

export interface AiChatInbound {
  workspaceId: string;
  conversationId: string;
  wamId: string;
  /** Sender number as Meta sends it: digits only. */
  waId: string;
  phoneNumberId: string;
  messageType: string;
  text: string;
}

export type AiChatOutcome =
  | { kind: "skipped"; reason: string }
  | { kind: "handover"; reason: string }
  | { kind: "sent"; outcome: string };

/**
 * Runs after the rule-based automations for a stored inbound text message. Sends a reply only
 * when the policy says send and the send goes through the outbound ledger (window and
 * idempotency enforced there). Otherwise hands the conversation to a person and sends nothing.
 * Callers wrap this in try/catch: a failure here must never break inbound ingestion.
 */
export async function maybeAutoReply(input: AiChatInbound): Promise<AiChatOutcome> {
  if (input.messageType !== "text" || !input.text.trim()) return { kind: "skipped", reason: "not a text message" };

  const settings = await getAiChatSettings(input.workspaceId);
  if (!settings.enabled) return { kind: "skipped", reason: "AI replies are off" };

  const conversation = await getConversation(input.workspaceId, input.conversationId);
  if (!conversation) return { kind: "skipped", reason: "conversation not found" };
  // A person already owns a pending conversation, and closed ones take no replies.
  if (conversation.status !== "open") return { kind: "skipped", reason: `conversation is ${conversation.status}` };

  // A rule-based reply already answered this message; never send two replies to one message.
  if (await ruleReplyExistsForMessage(input.workspaceId, input.wamId)) {
    return { kind: "skipped", reason: "a rule reply already answered this message" };
  }

  const flags = await getSenderFlags(input.workspaceId, input.waId);
  if (flags.blocked) return { kind: "skipped", reason: "sender is blocked" };
  if (isOptOutText(input.text)) {
    // Honour STOP: record the opt-out and send nothing.
    await recordInboundOptOut(input.workspaceId, input.waId);
    return { kind: "skipped", reason: "sender opted out" };
  }

  const windowOpen = Date.now() < new Date(conversation.windowExpiresAt).getTime();
  const catalogHits = windowOpen ? await loadCatalogueHits(input.workspaceId) : [];
  const rules = decideReply({
    inboundText: input.text,
    conversationStatus: conversation.status,
    windowOpen,
    aiEnabled: settings.enabled,
    optOut: flags.stopped,
    faq: parseFaqText(settings.faqText),
    catalogHits,
  });
  const decision: ReplyDecision = await decideWithModel(rules, input.text);

  if (decision.action === "ignore") return { kind: "skipped", reason: decision.reason };

  if (decision.action === "handover") {
    await handOverConversation(input.workspaceId, input.conversationId);
    console.log(`[AI Chat] handed over conversation ${input.conversationId}: ${decision.reason}`);
    return { kind: "handover", reason: decision.reason };
  }

  // Deterministic seed: a webhook retry for the same wam_id reuses the same ledger row.
  const outcome = await sendFreeTextInWindow({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    phoneNumberId: input.phoneNumberId,
    waId: input.waId,
    text: decision.text,
    seed: `ai-chat:${input.wamId}`,
    actor: "automation:ai-chat",
  });
  return { kind: "sent", outcome };
}

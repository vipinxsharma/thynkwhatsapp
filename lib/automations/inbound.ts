import { decideInbound } from "@/lib/chat-settings/handling";
import {
  claimHoldingMessage,
  getChatSettings,
  getSenderFlags,
  handOverConversation,
  recordInboundOptOut,
} from "@/lib/chat-settings/store";
import { recordReplyOutcome, routeInboundMessage } from "./store";
import { sendFreeTextInWindow, sendRuleReply } from "./sender";

export interface InboundAutomationInput {
  workspaceId: string;
  conversationId: string;
  wamId: string;
  /** Sender number as Meta sends it: digits only, no plus sign. */
  waId: string;
  /** Receiving WhatsApp number (phone number ID). */
  phoneNumberId: string;
  messageType: string;
  /** Message text for text messages, otherwise a caption or placeholder. */
  text: string;
  contactName: string;
  /** Conversation status before this message was applied. */
  conversationStatus: "open" | "pending" | "closed";
}

/**
 * Runs after an inbound message is stored. Order: blocked senders stop here; then the
 * unsubscribe and handover keywords; contacts who asked to stop get no automated messages;
 * then keyword rules and their replies; then the holding message when a person is expected
 * to reply later. Each step is applied at most once per inbound message (the routing run and
 * the outbound ledger both key on the wam ID).
 */
export async function handleInboundAutomation(input: InboundAutomationInput): Promise<void> {
  const { workspaceId, conversationId, wamId, waId, phoneNumberId } = input;
  const flags = await getSenderFlags(workspaceId, waId);
  if (flags.blocked) return;

  const settings = await getChatSettings(workspaceId);
  const isText = input.messageType === "text";
  const decision = decideInbound({ blocked: false, text: isText ? input.text : null, settings });
  const phone = `+${waId}`;
  // Meta sends the number as the name when the sender has no profile name.
  const name = /^\d+$/.test(input.contactName) ? "" : input.contactName;

  if (decision.kind === "unsubscribe") {
    await recordInboundOptOut(workspaceId, waId);
    return;
  }

  if (decision.kind === "handover") {
    await handOverConversation(workspaceId, conversationId);
    if (settings.handoverMessage && !flags.stopped) {
      await sendFreeTextInWindow({
        workspaceId, conversationId, phoneNumberId, waId, text: settings.handoverMessage,
        seed: `handover:${wamId}`, actor: "automation:handover",
      });
    }
    return;
  }

  // The contact asked to stop: no automated replies or holding messages from here on.
  if (flags.stopped) return;

  const handedOver = input.conversationStatus === "pending";
  let replied = false;
  if (isText) {
    const run = await routeInboundMessage(workspaceId, conversationId, wamId, phoneNumberId, input.text, {
      name, phone, handedOver,
    });
    if (run?.reply) {
      const outcome = await sendRuleReply({
        workspaceId, conversationId, phoneNumberId, waId, runId: run.runId,
        candidates: run.reply, actor: `automation:${run.ruleId}`,
      });
      await recordReplyOutcome(workspaceId, run.runId, outcome);
      replied = outcome === "sent" || outcome === "already_sent";
    }
  }

  if (!replied && handedOver && settings.holdingMessage && await claimHoldingMessage(workspaceId, conversationId)) {
    await sendFreeTextInWindow({
      workspaceId, conversationId, phoneNumberId, waId, text: settings.holdingMessage,
      seed: `holding:${conversationId}:${wamId}`, actor: "automation:holding",
    });
  }
}

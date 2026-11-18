import { afterEach, describe, expect, it, vi } from "vitest";

const chat = vi.hoisted(() => ({
  getChatSettings: vi.fn(),
  getSenderFlags: vi.fn(),
  recordInboundOptOut: vi.fn(),
  handOverConversation: vi.fn(),
  claimHoldingMessage: vi.fn(),
}));
const automation = vi.hoisted(() => ({
  routeInboundMessage: vi.fn(),
  recordReplyOutcome: vi.fn(),
}));
const sender = vi.hoisted(() => ({
  sendFreeTextInWindow: vi.fn(),
  sendRuleReply: vi.fn(),
}));

vi.mock("@/lib/chat-settings/store", () => chat);
vi.mock("@/lib/automations/store", () => automation);
vi.mock("@/lib/automations/sender", () => sender);

import { handleInboundAutomation, type InboundAutomationInput } from "../lib/automations/inbound";

const input: InboundAutomationInput = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  conversationId: "22222222-2222-4222-8222-222222222222",
  wamId: "wamid.HBgM",
  waId: "919876543210",
  phoneNumberId: "105678234901234",
  messageType: "text",
  text: "price please",
  contactName: "Asha",
  conversationStatus: "open",
};
const settings = { unsubscribeKeyword: "STOP", handoverKeyword: "AGENT", handoverMessage: "A person will reply.", holdingMessage: "We have your message." };

afterEach(() => { vi.clearAllMocks(); });

function arrange(overrides: Record<string, string | null> = {}, blocked = false, stopped = false) {
  chat.getChatSettings.mockResolvedValue({ ...settings, ...overrides });
  chat.getSenderFlags.mockResolvedValue({ blocked, stopped });
  chat.claimHoldingMessage.mockResolvedValue(true);
  sender.sendFreeTextInWindow.mockResolvedValue("sent");
}

describe("inbound automation order", () => {
  it("stores nothing new and answers nothing for a blocked sender", async () => {
    arrange({}, true);
    await handleInboundAutomation(input);
    expect(automation.routeInboundMessage).not.toHaveBeenCalled();
    expect(sender.sendFreeTextInWindow).not.toHaveBeenCalled();
    expect(sender.sendRuleReply).not.toHaveBeenCalled();
  });

  it("records an opt-out on the unsubscribe keyword and stops there", async () => {
    arrange();
    await handleInboundAutomation({ ...input, text: "stop" });
    expect(chat.recordInboundOptOut).toHaveBeenCalledWith(input.workspaceId, input.waId);
    expect(automation.routeInboundMessage).not.toHaveBeenCalled();
  });

  it("hands the chat to a person and sends the handover message", async () => {
    arrange();
    await handleInboundAutomation({ ...input, text: "AGENT" });
    expect(chat.handOverConversation).toHaveBeenCalledWith(input.workspaceId, input.conversationId);
    expect(sender.sendFreeTextInWindow).toHaveBeenCalledWith(expect.objectContaining({
      text: "A person will reply.", seed: `handover:${input.wamId}`,
    }));
    expect(automation.routeInboundMessage).not.toHaveBeenCalled();
  });

  it("sends a rule reply and records its outcome", async () => {
    arrange();
    const reply = { text: "Hi Asha", templateName: null, templateLanguage: null, templateVariables: [] };
    automation.routeInboundMessage.mockResolvedValueOnce({ runId: "run-1", ruleId: "rule-1", ruleName: "Pricing", reply });
    sender.sendRuleReply.mockResolvedValueOnce("sent");
    await handleInboundAutomation(input);
    expect(sender.sendRuleReply).toHaveBeenCalledWith(expect.objectContaining({ runId: "run-1", candidates: reply, actor: "automation:rule-1" }));
    expect(automation.recordReplyOutcome).toHaveBeenCalledWith(input.workspaceId, "run-1", "sent");
    expect(sender.sendFreeTextInWindow).not.toHaveBeenCalled();
  });

  it("passes the handed-over state and sends the holding message once, when no reply went out", async () => {
    arrange();
    automation.routeInboundMessage.mockResolvedValueOnce(null);
    await handleInboundAutomation({ ...input, conversationStatus: "pending" });
    expect(automation.routeInboundMessage).toHaveBeenCalledWith(input.workspaceId, input.conversationId, input.wamId, input.phoneNumberId, input.text,
      expect.objectContaining({ handedOver: true, name: "Asha", phone: "+919876543210" }));
    expect(chat.claimHoldingMessage).toHaveBeenCalledWith(input.workspaceId, input.conversationId);
    expect(sender.sendFreeTextInWindow).toHaveBeenCalledWith(expect.objectContaining({ text: "We have your message." }));
  });

  it("does not send the holding message when the chat is not waiting for a person or another claim exists", async () => {
    arrange();
    automation.routeInboundMessage.mockResolvedValueOnce(null);
    await handleInboundAutomation(input);
    expect(chat.claimHoldingMessage).not.toHaveBeenCalled();

    chat.claimHoldingMessage.mockResolvedValueOnce(false);
    await handleInboundAutomation({ ...input, conversationStatus: "pending" });
    expect(sender.sendFreeTextInWindow).not.toHaveBeenCalled();
  });

  it("gives a contact who asked to stop no rule reply or holding message", async () => {
    arrange({}, false, true);
    automation.routeInboundMessage.mockResolvedValueOnce(null);
    await handleInboundAutomation({ ...input, conversationStatus: "pending" });
    expect(automation.routeInboundMessage).not.toHaveBeenCalled();
    expect(chat.claimHoldingMessage).not.toHaveBeenCalled();
    expect(sender.sendFreeTextInWindow).not.toHaveBeenCalled();
  });

  it("still hands over a stopped contact to a person, but sends no automated handover message", async () => {
    arrange({}, false, true);
    await handleInboundAutomation({ ...input, text: "AGENT" });
    expect(chat.handOverConversation).toHaveBeenCalledWith(input.workspaceId, input.conversationId);
    expect(sender.sendFreeTextInWindow).not.toHaveBeenCalled();
  });

  it("never treats a digits-only contact name as a name", async () => {
    arrange();
    automation.routeInboundMessage.mockResolvedValueOnce(null);
    await handleInboundAutomation({ ...input, contactName: "919876543210" });
    expect(automation.routeInboundMessage).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(),
      expect.objectContaining({ name: "" }));
  });

  it("routes only text messages", async () => {
    arrange({ holdingMessage: null });
    await handleInboundAutomation({ ...input, messageType: "image", text: "[Attachment: image]" });
    expect(automation.routeInboundMessage).not.toHaveBeenCalled();
  });
});

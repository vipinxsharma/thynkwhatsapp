import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decideReply,
  isOptOutText,
  parseFaqText,
  validateAiChatSettings,
  type DecideReplyInput,
  type FaqEntry,
} from "../lib/ai/chat";
import { decideWithModel, paraphraseIsSafe, parseModelDraft } from "../lib/ai/chat-model";

const faq: FaqEntry[] = [
  { question: "What are your opening hours?", answer: "We are open 10am to 6pm, Monday to Saturday." },
  { question: "Where is your store located?", answer: "Shop 4, MG Road, Pune." },
];

function input(overrides: Partial<DecideReplyInput> = {}): DecideReplyInput {
  return {
    inboundText: "what are your opening hours",
    conversationStatus: "open",
    windowOpen: true,
    aiEnabled: true,
    optOut: false,
    faq,
    catalogHits: [],
    ...overrides,
  };
}

describe("decideReply: ignore branches", () => {
  it("ignores when AI replies are off", () => {
    const decision = decideReply(input({ aiEnabled: false }));
    expect(decision.action).toBe("ignore");
  });

  it("ignores when the conversation is closed", () => {
    expect(decideReply(input({ conversationStatus: "closed" })).action).toBe("ignore");
  });

  it("ignores when the sender opted out", () => {
    expect(decideReply(input({ optOut: true })).action).toBe("ignore");
  });

  it("ignores a STOP word even when the stored flag is not set yet", () => {
    expect(decideReply(input({ inboundText: "STOP" })).action).toBe("ignore");
  });
});

describe("STOP handling", () => {
  it.each(["stop", "  STOP  ", "Unsubscribe", "cancel", "END", "quit", "opt out", "Stop All"])("treats %j as an opt-out", (text) => {
    expect(isOptOutText(text)).toBe(true);
  });

  it("does not treat a sentence that contains a STOP word as an opt-out", () => {
    expect(isOptOutText("please stop by the store tomorrow")).toBe(false);
    expect(decideReply(input({ inboundText: "please stop by, what are the store hours", faq: [{ question: "store hours", answer: "Open 9 to 5." }] })).action).toBe("send");
  });
});

describe("decideReply: window rule", () => {
  it("hands over when the 24-hour window is closed, even with a matching FAQ", () => {
    const decision = decideReply(input({ windowOpen: false }));
    expect(decision).toEqual({ action: "handover", reason: "24-hour window is closed" });
  });
});

describe("decideReply: handover rules", () => {
  it.each([
    ["I want to talk to a human", "asks for a human"],
    ["can I speak to the manager", "asks for a human"],
    ["what is the refund policy", "mentions money"],
    ["I was charged twice", "mentions money"],
    ["is it ₹499 or ₹899", "mentions money"],
    ["this is a complete scam", "complaint"],
    ["I am so angry about my order", "complaint"],
    ["I will call my lawyer", "legal matter"],
    ["I want to take legal action", "legal matter"],
    ["I have a medical allergy to this, is it safe", "health matter"],
    ["my doctor said to ask about dosage", "health matter"],
  ])("hands over for %j", (text, reason) => {
    const decision = decideReply(input({ inboundText: text }));
    expect(decision.action).toBe("handover");
    expect(decision.reason).toBe(reason);
  });

  it("hands over when no confident answer exists in FAQ or catalogue", () => {
    const decision = decideReply(input({ inboundText: "do you ship to Mars", catalogHits: [] }));
    expect(decision).toEqual({ action: "handover", reason: "no confident answer in FAQ or catalogue" });
  });

  it("hands over when only one weak word overlaps", () => {
    const decision = decideReply(input({ inboundText: "what time is your bus to Jaipur", faq }));
    expect(decision.action).toBe("handover");
  });
});

describe("decideReply: send rules", () => {
  it("sends the FAQ answer verbatim for a confident FAQ match", () => {
    const decision = decideReply(input());
    expect(decision).toMatchObject({ action: "send", text: "We are open 10am to 6pm, Monday to Saturday.", source: "faq" });
  });

  it("falls back to a confident catalogue description when the FAQ has no match", () => {
    const decision = decideReply(input({
      inboundText: "do you have a leather wallet",
      faq: [],
      catalogHits: [{ name: "Leather wallet", text: "Handmade leather wallet with six card slots." }],
    }));
    expect(decision).toMatchObject({ action: "send", text: "Handmade leather wallet with six card slots.", source: "catalogue" });
  });

  it("prefers the FAQ over the catalogue when both match", () => {
    const decision = decideReply(input({
      inboundText: "store location",
      catalogHits: [{ name: "Store", text: "Store in Mumbai." }],
    }));
    expect(decision).toMatchObject({ action: "send", source: "faq" });
  });

  it("caps the reply length", () => {
    const long = "a".repeat(2000);
    const decision = decideReply(input({ faq: [{ question: "opening hours", answer: long }] }));
    expect(decision.action === "send" && decision.text.length).toBe(1000);
  });
});

describe("parseFaqText and validateAiChatSettings", () => {
  it("parses Q and A blocks and drops entries without an answer", () => {
    const parsed = parseFaqText("Q: Hours?\nA: 9 to 5\nmore detail\n\nQ: Empty\n\nQ: Ship?\nA: Yes");
    expect(parsed).toEqual([
      { question: "Hours?", answer: "9 to 5 more detail" },
      { question: "Ship?", answer: "Yes" },
    ]);
  });

  it("rejects FAQ text over 4000 characters", () => {
    expect(() => validateAiChatSettings({ enabled: true, faq_text: "x".repeat(4001) })).toThrow(/4000/);
  });

  it("requires enabled to be a boolean", () => {
    expect(() => validateAiChatSettings({ enabled: "yes", faq_text: "" })).toThrow(/enabled/);
  });

  it("turns blank FAQ text into null", () => {
    expect(validateAiChatSettings({ enabled: false, faq_text: "   " })).toEqual({ enabled: false, faqText: null, handoverContact: null });
  });
});

describe("model step", () => {
  const sendDecision = { action: "send" as const, text: "Open 10am to 6pm, Monday to Saturday.", reason: "confident FAQ match", source: "faq" as const };

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-openai";
    process.env.ANTHROPIC_API_KEY = "test-anthropic";
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    vi.restoreAllMocks();
  });

  function modelResponse(content: string) {
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  }

  it("uses a safe paraphrase from the model", async () => {
    const fetchMock = vi.fn(async () => modelResponse(JSON.stringify({ confident: true, reply: "We're open from 10am to 6pm, Monday to Saturday." })));
    const decision = await decideWithModel(sendDecision, "when are you open", fetchMock as unknown as typeof fetch);
    expect(decision).toMatchObject({ action: "send", text: "We're open from 10am to 6pm, Monday to Saturday." });
  });

  it("cannot add a price the source does not contain", async () => {
    const fetchMock = vi.fn(async () => modelResponse(JSON.stringify({ confident: true, reply: "Open 10am to 6pm. Our fee is ₹299." })));
    const decision = await decideWithModel(sendDecision, "when are you open", fetchMock as unknown as typeof fetch);
    expect(decision).toEqual(sendDecision);
  });

  it("cannot add a number the source does not contain", async () => {
    const fetchMock = vi.fn(async () => modelResponse(JSON.stringify({ confident: true, reply: "Open until 9pm." })));
    const decision = await decideWithModel(sendDecision, "when are you open", fetchMock as unknown as typeof fetch);
    expect(decision).toEqual(sendDecision);
  });

  it("cannot add a link or email the source does not contain", () => {
    expect(paraphraseIsSafe("Book at www.example-offers.com", sendDecision.text)).toBe(false);
    expect(paraphraseIsSafe("Email sales@example.com", sendDecision.text)).toBe(false);
  });

  it("hands over when the model says it is not confident", async () => {
    const fetchMock = vi.fn(async () => modelResponse(JSON.stringify({ confident: false, reply: "" })));
    const decision = await decideWithModel(sendDecision, "when are you open", fetchMock as unknown as typeof fetch);
    expect(decision.action).toBe("handover");
  });

  it("falls back to the rules decision when the model call fails", async () => {
    const fetchMock = vi.fn(async () => new Response("server error", { status: 500 }));
    const decision = await decideWithModel(sendDecision, "when are you open", fetchMock as unknown as typeof fetch);
    expect(decision).toEqual(sendDecision);
  });

  it("falls back to the rules decision when the model throws", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("network down"); });
    const decision = await decideWithModel(sendDecision, "when are you open", fetchMock as unknown as typeof fetch);
    expect(decision).toEqual(sendDecision);
  });

  it("falls back to the rules decision when the model returns malformed JSON", async () => {
    const fetchMock = vi.fn(async () => modelResponse("not json at all"));
    const decision = await decideWithModel(sendDecision, "when are you open", fetchMock as unknown as typeof fetch);
    expect(decision).toEqual(sendDecision);
  });

  it("uses Claude when OpenAI fails", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("openai")) return new Response("down", { status: 503 });
      return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ confident: true, reply: "Open 10am to 6pm, Monday to Saturday." }) }] }), { status: 200 });
    });
    const decision = await decideWithModel(sendDecision, "when are you open", fetchMock as unknown as typeof fetch);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(decision).toMatchObject({ action: "send", text: "Open 10am to 6pm, Monday to Saturday." });
  });

  it("does not call the model for a handover decision", async () => {
    const fetchMock = vi.fn();
    const handover = { action: "handover" as const, reason: "mentions money" };
    expect(await decideWithModel(handover, "refund please", fetchMock as unknown as typeof fetch)).toEqual(handover);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses only the expected JSON shape", () => {
    expect(parseModelDraft('{"confident": true, "reply": " hi "}')).toEqual({ confident: true, reply: "hi" });
    expect(parseModelDraft('{"confident": "yes", "reply": "hi"}')).toBeNull();
    expect(parseModelDraft(null)).toBeNull();
  });
});

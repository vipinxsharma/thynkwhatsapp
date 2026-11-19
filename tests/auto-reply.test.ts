import { describe, expect, it } from "vitest";
import {
  chooseReplyMode,
  deterministicUuid,
  isBotEcho,
  renderPlaceholders,
  RuleValidationError,
  sanitizeTemplateParameter,
  validateReplyText,
} from "../lib/automations/reply";
import { parseRoutingRule, matchRoutingRule, type RoutingRule } from "../lib/automations/routing";

const base = { name: "Pricing", channelId: null, matchType: "contains", keywords: ["price"], tags: [], conversationStatus: null, priority: 100, enabled: true };

describe("reply placeholders", () => {
  it("replaces {{name}} and {{phone}} and falls back to 'there' for an unknown name", () => {
    expect(renderPlaceholders("Hi {{name}}, call {{ phone }}", { name: "Asha", phone: "+919876543210" }))
      .toBe("Hi Asha, call +919876543210");
    expect(renderPlaceholders("Hi {{name}}", { name: "  ", phone: "+1" })).toBe("Hi there");
  });

  it("rejects unknown placeholders so a typo never reaches a customer", () => {
    expect(() => validateReplyText("Hello {{email}}")).toThrow(RuleValidationError);
    expect(() => validateReplyText("Hello {{ name }}")).not.toThrow();
  });

  it("rejects empty or oversized reply text", () => {
    expect(() => validateReplyText("   ")).toThrow(RuleValidationError);
    expect(() => validateReplyText("x".repeat(1025))).toThrow(RuleValidationError);
  });

  it("flattens template parameters to one bounded line", () => {
    expect(sanitizeTemplateParameter("Asha\n\tKumar   Sharma")).toBe("Asha Kumar Sharma");
    expect(sanitizeTemplateParameter("   ")).toBe(" ");
  });
});

describe("reply rules", () => {
  it("accepts a reply-only rule and keeps the template settings", () => {
    const parsed = parseRoutingRule({ ...base, replyText: "Hi {{name}}", replyTemplateName: "price_follow_up", replyTemplateLanguage: "en_US", replyTemplateVariables: ["{{name}}"] });
    expect(parsed.tags).toEqual([]);
    expect(parsed.replyTemplateVariables).toEqual(["{{name}}"]);
  });

  it("rejects a rule with no action at all", () => {
    expect(() => parseRoutingRule(base)).toThrow(RuleValidationError);
  });

  it("requires a language with a template, variables with a template, and a valid template name", () => {
    expect(() => parseRoutingRule({ ...base, replyTemplateName: "price_follow_up" })).toThrow("language");
    expect(() => parseRoutingRule({ ...base, replyTemplateVariables: ["x"] })).toThrow("template name");
    expect(() => parseRoutingRule({ ...base, replyTemplateName: "Price Follow", replyTemplateLanguage: "en_US" })).toThrow("lowercase");
    expect(() => parseRoutingRule({ ...base, replyTemplateName: "a", replyTemplateLanguage: "en_US", replyTemplateVariables: Array(11).fill("x") })).toThrow();
  });

  it("rejects unknown placeholders inside template variables", () => {
    expect(() => parseRoutingRule({ ...base, replyTemplateName: "a", replyTemplateLanguage: "en_US", replyTemplateVariables: ["{{code}}"] })).toThrow("unknown placeholder");
  });
});

describe("reply mode inside and outside the 24-hour window", () => {
  const both = { text: "Hi", templateName: "follow_up", templateLanguage: "en_US", templateVariables: ["Asha"] };
  it("uses text inside the window when text is set", () => {
    expect(chooseReplyMode(both, true)).toEqual({ mode: "text", text: "Hi" });
  });
  it("uses the approved template outside the window", () => {
    expect(chooseReplyMode(both, false)).toEqual({ mode: "template", name: "follow_up", language: "en_US", variables: ["Asha"] });
  });
  it("uses the template inside the window when no text is set", () => {
    expect(chooseReplyMode({ ...both, text: null }, true)).toMatchObject({ mode: "template" });
  });
  it("skips with a reason when nothing can be sent", () => {
    expect(chooseReplyMode({ ...both, templateName: null, templateLanguage: null }, false)).toEqual({ mode: "skip", reason: "window_closed" });
    expect(chooseReplyMode({ text: null, templateName: null, templateLanguage: null, templateVariables: [] }, true)).toEqual({ mode: "skip", reason: "no_reply_configured" });
  });
});

describe("loop guard", () => {
  it("treats an inbound message that repeats a recent bot reply as an echo", () => {
    expect(isBotEcho("  Thanks   for asking. We can help!", ["Thanks for asking. We can help!"])).toBe(true);
    expect(isBotEcho("Thanks for asking", ["Thanks for asking. We can help!"])).toBe(false);
  });

  it("does not match an empty message", () => {
    expect(isBotEcho("   ", ["   "])).toBe(false);
  });

  it("never lets a rule fire on its own reply text", () => {
    const rule: RoutingRule = { ...parseRoutingRule({ ...base, keywords: ["price"], replyText: "Our price list is attached" }), id: "r1", updatedAt: "2026-11-19T00:00:00Z" };
    expect(matchRoutingRule([rule], "Our price list is attached", "12345")?.id).toBe("r1");
    expect(isBotEcho("Our price list is attached", [rule.replyText as string])).toBe(true);
  });
});

describe("deterministic idempotency keys", () => {
  it("returns the same UUID version 5 value for the same seed", () => {
    const first = deterministicUuid("automation:run-1");
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(deterministicUuid("automation:run-1")).toBe(first);
    expect(deterministicUuid("automation:run-2")).not.toBe(first);
  });
});

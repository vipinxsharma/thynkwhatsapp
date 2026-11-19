import { afterEach, describe, expect, it, vi } from "vitest";
import { assistDraft, checkDraft, rejectionHints, type AssistDraft } from "../lib/templates/assist";

const base: AssistDraft = { name: "order_update", category: "UTILITY", language: "en_US", bodyText: "Hi {{1}}, your order #{{2}} is confirmed." };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("checkDraft", () => {
  it("suggests Utility for an order confirmation", () => {
    const result = checkDraft(base);
    expect(result.suggestedCategory).toBe("UTILITY");
    expect(result.issues.filter((item) => item.severity === "error")).toEqual([]);
  });

  it("suggests Marketing for a sale and flags it when filed as Utility", () => {
    const result = checkDraft({ ...base, bodyText: "Hi {{1}}, flash sale: 50% off, limited stock. Shop now!" });
    expect(result.suggestedCategory).toBe("MARKETING");
    expect(result.issues.some((item) => item.severity === "error" && /Promotional wording/.test(item.message))).toBe(true);
  });

  it("suggests Authentication for a one-time code", () => {
    expect(checkDraft({ ...base, bodyText: "Your verification code is {{1}}." }).suggestedCategory).toBe("AUTHENTICATION");
  });

  it("flags gaps in variable numbering and named variables", () => {
    expect(checkDraft({ ...base, bodyText: "Hi {{1}} and {{3}}" }).issues.some((item) => /without gaps/.test(item.message))).toBe(true);
    expect(checkDraft({ ...base, bodyText: "Hi {{name}}" }).issues.some((item) => /numbered/.test(item.message))).toBe(true);
  });

  it("flags length limits and a bad template name", () => {
    const result = checkDraft({ ...base, name: "Order Update!", bodyText: "x".repeat(1025) });
    expect(result.issues.map((item) => item.message).join(" ")).toMatch(/1024/);
    expect(result.issues.map((item) => item.message).join(" ")).toMatch(/lowercase/);
  });

  it("asks for sample values when variables are present", () => {
    expect(checkDraft(base).issues.some((item) => item.severity === "warning" && /sample value/.test(item.message))).toBe(true);
  });
});

describe("rejectionHints", () => {
  it("maps common Meta rejection reasons to a fix", () => {
    expect(rejectionHints("Template contains promotional content")[0]).toMatch(/promotion/);
    expect(rejectionHints("Variable parameters do not match examples")[0]).toMatch(/example/);
  });

  it("gives a generic fix when the cause is not recognised", () => {
    expect(rejectionHints("Something unusual")[0]).toMatch(/did not name the cause/);
  });
});

describe("assistDraft", () => {
  it("uses rules only when no model key is configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const result = await assistDraft(base);
    expect(result.source).toBe("rules");
  });

  it("asks OpenAI first and uses its suggestion", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai");
    const fetchMock = vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        suggestedCategory: "UTILITY", categoryReasons: ["Order update"], issues: [],
        suggestion: { bodyText: "Hi {{1}}, your order #{{2}} is confirmed." },
      }) } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await assistDraft(base);
    expect(result.source).toBe("openai");
    expect(result.suggestion?.bodyText).toMatch(/confirmed/);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/api\.openai\.com/);
  });

  it("falls back to Claude when OpenAI fails", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic");
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("openai")) return new Response("down", { status: 500 });
      return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({
        suggestedCategory: "UTILITY", categoryReasons: [], issues: [], suggestion: null,
      }) }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    expect((await assistDraft(base)).source).toBe("anthropic");
  });

  it("keeps the rules answer when the model returns something unusable", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), { status: 200 })));
    const result = await assistDraft(base);
    expect(result.source).toBe("rules");
  });

  it("offers rejection hints for a rejected template when no model answers", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const result = await assistDraft({ ...base, bodyText: "Hi {{1}}, big sale!" }, "Template contains promotional content");
    expect(result.suggestion?.fixNotes?.[0]).toMatch(/promotion/);
  });
});

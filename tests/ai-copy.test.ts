import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: vi.fn(async () => ({
    ok: true as const,
    session: { tenantId: "t1", userId: "u1", role: "agent" },
  })),
}));

import { askModel, aiConfigured } from "@/lib/ai/providers";
import {
  describeProduct,
  improveReply,
  rulesDescribeProduct,
  rulesImproveReply,
  hasInventedClaim,
} from "@/lib/ai/copy";
import { POST } from "@/app/api/ai/copy/route";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function openAIReply(content: string) {
  return jsonResponse({ choices: [{ message: { content } }] });
}

function anthropicReply(text: string) {
  return jsonResponse({ content: [{ type: "text", text }] });
}

describe("providers", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reports unconfigured when no key is set", () => {
    expect(aiConfigured()).toBe(false);
  });

  it("returns null without calling fetch when no key is set", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await askModel({ system: "s", user: "u", json: true })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses OpenAI first when it succeeds", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test-anthropic");
    const fetchMock = vi.fn(async (_url: string) => openAIReply('{"ok":true}'));
    vi.stubGlobal("fetch", fetchMock);
    const answer = await askModel({ system: "s", user: "u", json: true });
    expect(answer).toEqual({ source: "openai", text: '{"ok":true}' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.openai.com");
  });

  it("falls back to Claude when OpenAI fails", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test-anthropic");
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("openai") ? jsonResponse({ error: "down" }, 500) : anthropicReply('{"ok":true}')
    );
    vi.stubGlobal("fetch", fetchMock);
    const answer = await askModel({ system: "s", user: "u", json: true });
    expect(answer).toEqual({ source: "anthropic", text: '{"ok":true}' });
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://api.openai.com/v1/chat/completions",
      "https://api.anthropic.com/v1/messages",
    ]);
  });

  it("returns null and never throws when both providers fail", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test-anthropic");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    expect(await askModel({ system: "s", user: "u" })).toBeNull();
  });
});

describe("rules", () => {
  it("describes a product from supplied facts only", () => {
    const result = rulesDescribeProduct({ name: "Steel bottle", priceInr: 1499, sku: "SB-1", notes: "Holds 750 ml." });
    expect(result.source).toBe("rules");
    expect(result.text).toContain("Steel bottle");
    expect(result.text).toContain("₹1,499");
    expect(result.text).toContain("750 ml");
    expect(result.text).not.toMatch(/warrant|guarantee|discount|certified/i);
    expect(result.text.length).toBeLessThanOrEqual(400);
  });

  it("notes missing price and notes as issues", () => {
    const result = rulesDescribeProduct({ name: "Mug" });
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("truncates long descriptions to 400 characters", () => {
    const result = rulesDescribeProduct({ name: "X", notes: "word ".repeat(200) });
    expect(result.text.length).toBeLessThanOrEqual(400);
    expect(result.issues.join(" ")).toContain("shortened");
  });

  it("returns reply unchanged with issues when no model is configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const input = "SEND ME THE INVOICE NOW";
    const result = await improveReply({ text: input });
    expect(result.text).toBe(input);
    expect(result.source).toBe("rules");
    expect(result.issues.join(" ")).toMatch(/capitals/);
    expect(result.issues.join(" ")).toMatch(/greeting/);
    vi.unstubAllEnvs();
  });

  it("flags replies that are too long", () => {
    const result = rulesImproveReply({ text: "Hello. " + "a".repeat(1000) });
    expect(result.issues.join(" ")).toMatch(/longer than 1000/);
  });
});

describe("model output is checked", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects a description that invents a warranty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => openAIReply('{"description":"Steel bottle with a 2 year warranty."}')));
    const result = await describeProduct({ name: "Steel bottle", priceInr: 1499 });
    expect(result.text).not.toMatch(/warranty/i);
    expect(result.source).toBe("rules");
    expect(result.issues.join(" ")).toMatch(/added a claim/);
  });

  it("accepts a model description that only uses supplied facts", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => openAIReply('{"description":"Steel bottle at ₹1,499 that holds 750 ml."}')));
    const result = await describeProduct({ name: "Steel bottle", priceInr: 1499, notes: "Holds 750 ml." });
    expect(result).toMatchObject({ source: "openai", text: "Steel bottle at ₹1,499 that holds 750 ml." });
  });

  it("rejects an improved reply that adds a promise", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => openAIReply('{"text":"Hello, your order will arrive tomorrow."}')));
    const result = await improveReply({ text: "hi where is my order" });
    expect(result.text).toBe("hi where is my order");
    expect(result.source).toBe("rules");
  });

  it("rejects an improved reply that adds a price", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => openAIReply('{"text":"Hello, it costs ₹500."}')));
    const result = await improveReply({ text: "hello what is the price" });
    expect(result.source).toBe("rules");
  });

  it("accepts a clearer reply that keeps the meaning", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => openAIReply('{"text":"Hello, thank you for reaching out. We are checking your order."}')));
    const result = await improveReply({ text: "hi checking order" });
    expect(result).toMatchObject({ source: "openai" });
  });
});

describe("invented-claim check", () => {
  it("allows a claim word the user supplied", () => {
    expect(hasInventedClaim("Certified organic tea.", "Certified organic tea")).toBe(false);
  });
  it("flags a claim word the user did not supply", () => {
    expect(hasInventedClaim("Premium tea with a warranty.", "Tea")).toBe(true);
  });
});

describe("POST /api/ai/copy", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function request(body: unknown) {
    return new NextRequest("http://localhost/api/ai/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("refuses an unknown action", async () => {
    const response = await POST(request({ action: "send_to_whatsapp" }));
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("refuses an empty product name", async () => {
    const response = await POST(request({ action: "describe_product", name: "   " }));
    expect(response.status).toBe(400);
  });

  it("refuses a reply over 1000 characters", async () => {
    const response = await POST(request({ action: "improve_reply", text: "a".repeat(1001) }));
    expect(response.status).toBe(400);
  });

  it("returns data for a valid describe_product call", async () => {
    const response = await POST(request({ action: "describe_product", name: "Mug", priceInr: 299 }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.source).toBe("rules");
    expect(body.data.text).toContain("₹299");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const store = vi.hoisted(() => ({
  getChatSettings: vi.fn(),
  saveChatSettings: vi.fn(),
  listBlockedNumbers: vi.fn(),
  blockNumber: vi.fn(),
  unblockNumber: vi.fn(),
}));
const auth = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => ({ ok: true, session: { tenantId: "11111111-1111-4111-8111-111111111111", userId: "owner" } }) as any));
vi.mock("@/lib/auth/session", () => ({ requireApiSession: auth }));
vi.mock("@/lib/chat-settings/store", () => store);

import { decideInbound, emptyChatSettings, messageIsKeyword, parseBlockedNumber, parseChatSettings } from "../lib/chat-settings/handling";
import { GET, PUT } from "../app/api/chat-settings/route";
import { DELETE, POST } from "../app/api/chat-settings/blocked/route";

const settings = { unsubscribeKeyword: "STOP", handoverKeyword: "AGENT", handoverMessage: "A person will reply soon.", holdingMessage: null };

afterEach(() => { vi.clearAllMocks(); });

function request(method: string, body?: unknown, suffix = "") {
  return new NextRequest(`https://xeccel.com/api/chat-settings${suffix}`, { method, body: body ? JSON.stringify(body) : undefined });
}

describe("inbound decisions", () => {
  it("never answers a blocked sender, even with a keyword", () => {
    expect(decideInbound({ blocked: true, text: "STOP", settings })).toEqual({ kind: "blocked" });
  });

  it("checks unsubscribe before handover, and matches whole messages only", () => {
    expect(decideInbound({ blocked: false, text: " stop ", settings })).toEqual({ kind: "unsubscribe" });
    expect(decideInbound({ blocked: false, text: "agent", settings })).toEqual({ kind: "handover" });
    expect(decideInbound({ blocked: false, text: "please stop sending", settings })).toEqual({ kind: "route" });
  });

  it("routes non-text messages and messages with no keyword configured", () => {
    expect(decideInbound({ blocked: false, text: null, settings })).toEqual({ kind: "route" });
    expect(decideInbound({ blocked: false, text: "STOP", settings: emptyChatSettings })).toEqual({ kind: "route" });
    expect(messageIsKeyword("STOP", null)).toBe(false);
  });
});

describe("settings validation", () => {
  it("trims values and allows empty optional fields", () => {
    expect(parseChatSettings({ unsubscribeKeyword: " STOP ", handoverKeyword: "", handoverMessage: null, holdingMessage: "  Hold on  " })).toEqual({
      unsubscribeKeyword: "STOP", handoverKeyword: null, handoverMessage: null, holdingMessage: "Hold on",
    });
  });

  it("rejects the same word for unsubscribe and handover, ignoring case", () => {
    expect(() => parseChatSettings({ ...settings, handoverKeyword: "stop" })).toThrow("must be different");
  });

  it("rejects over-long, multi-line or placeholder-bearing keywords and oversized messages", () => {
    expect(() => parseChatSettings({ ...settings, unsubscribeKeyword: "x".repeat(41) })).toThrow();
    expect(() => parseChatSettings({ ...settings, handoverKeyword: "two\nlines" })).toThrow();
    expect(() => parseChatSettings({ ...settings, handoverMessage: "Hi {{email}}" })).toThrow("unknown placeholder");
    expect(() => parseChatSettings({ ...settings, holdingMessage: "x".repeat(1025) })).toThrow();
  });

  it("normalises blocked numbers to digits and rejects short ones", () => {
    expect(parseBlockedNumber("+91 98765-43210")).toBe("919876543210");
    expect(() => parseBlockedNumber("12345")).toThrow("country code");
  });
});

describe("chat settings routes", () => {
  it("rejects unauthenticated and non-admin callers before touching storage", async () => {
    auth.mockResolvedValueOnce({ ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    expect((await PUT(request("PUT", settings))).status).toBe(403);
    expect(auth).toHaveBeenLastCalledWith(expect.anything(), ["owner", "admin"]);
    expect(store.saveChatSettings).not.toHaveBeenCalled();
  });

  it("returns settings and blocked numbers to owners and admins", async () => {
    store.getChatSettings.mockResolvedValueOnce(settings);
    store.listBlockedNumbers.mockResolvedValueOnce([{ waId: "919876543210", createdAt: "2026-11-19T00:00:00Z" }]);
    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ settings, blockedNumbers: [{ waId: "919876543210" }] });
  });

  it("saves only validated settings for the signed-in workspace", async () => {
    store.saveChatSettings.mockResolvedValueOnce(settings);
    const response = await PUT(request("PUT", { ...settings, workspaceId: "attacker" }));
    expect(response.status).toBe(200);
    expect(store.saveChatSettings).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "owner", settings);
  });

  it("answers invalid settings with 400 and does not call storage", async () => {
    const response = await PUT(request("PUT", { ...settings, handoverKeyword: "STOP" }));
    expect(response.status).toBe(400);
    expect(store.saveChatSettings).not.toHaveBeenCalled();
  });

  it("blocks a number by digits and unblocks it by query string", async () => {
    store.listBlockedNumbers.mockResolvedValue([]);
    expect((await POST(request("POST", { phone: "+91 98765 43210" }, "/blocked"))).status).toBe(201);
    expect(store.blockNumber).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "owner", "919876543210");
    store.unblockNumber.mockResolvedValueOnce(false);
    const missing = await DELETE(new NextRequest("https://xeccel.com/api/chat-settings/blocked?waId=919876543210", { method: "DELETE" }));
    expect(missing.status).toBe(404);
  });
});

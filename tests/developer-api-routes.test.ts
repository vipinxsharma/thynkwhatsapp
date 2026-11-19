import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  consume: vi.fn(),
  ensureContact: vi.fn(),
  upsertContact: vi.fn(),
  send: vi.fn(),
  durable: vi.fn(),
  listContacts: vi.fn(),
  connection: vi.fn(),
  getTemplates: vi.fn(),
}));

vi.mock("@/lib/developer/db", () => ({
  developerStorageConfigured: () => true,
  developerDatabase: () => ({ query: vi.fn() }),
  recordAuditEvent: vi.fn(),
}));
vi.mock("@/lib/developer/api-key-store", () => ({ authenticateApiKey: mocks.authenticate }));
vi.mock("@/lib/developer/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/developer/rate-limit")>();
  return { ...actual, consumeApiKeyRateLimit: mocks.consume };
});
vi.mock("@/lib/developer/contacts", () => ({ listContactsPage: mocks.listContacts }));
vi.mock("@/lib/inbox/store", () => ({
  ensureContactConversation: mocks.ensureContact,
  upsertContactByPhone: mocks.upsertContact,
}));
vi.mock("@/lib/messaging/send-message", () => ({ sendWorkspaceMessage: mocks.send }));
vi.mock("@/lib/strapi/client", () => ({ isDurableInboxEnabled: () => mocks.durable() }));
vi.mock("@/lib/meta/connections", () => ({ getMetaConnectionForWorkspace: mocks.connection }));
vi.mock("@/lib/meta/client", () => ({
  MetaGraphClient: class {
    getTemplates = mocks.getTemplates;
  },
}));

import { POST as postMessage } from "../app/api/v1/messages/route";
import { GET as getContacts, POST as postContact } from "../app/api/v1/contacts/route";
import { GET as getTemplates } from "../app/api/v1/templates/route";
import { decodeContactCursor, encodeContactCursor, normalizeRecipientPhone, parseLimit, parseSendRequest } from "../lib/developer/validation";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const keyId = "22222222-2222-4222-8222-222222222222";
const apiKey = "xk_live_" + "A".repeat(43);
const idempotencyKey = "33333333-3333-4333-8333-333333333333";
const conversationId = "44444444-4444-4444-8444-444444444444";

function bearer(headers: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}`, ...headers };
}

function jsonRequest(url: string, method: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json", ...bearer(headers) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticate.mockResolvedValue({ id: keyId, workspaceId, name: "Orders", createdByAuthUserId: "user-1" });
  mocks.consume.mockResolvedValue({ allowed: true, limit: 60, remaining: 59, resetAt: 1_800_000_060 });
  mocks.durable.mockReturnValue(true);
  mocks.ensureContact.mockResolvedValue({ conversation: { id: conversationId } });
  mocks.send.mockResolvedValue({
    status: 200,
    body: { success: true, data: { id: "m1", wamId: "wamid.1", conversationId, type: "text", status: "sent", timestamp: "now" } },
  });
});

describe("developer API authentication", () => {
  it("answers 401 with a JSON error when no key is sent", async () => {
    const response = await postMessage(new NextRequest("http://localhost/api/v1/messages", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthorized", message: "Send your API key as: Authorization: Bearer <key>" },
    });
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });

  it("does not look up a token that is not in key format", async () => {
    const request = new NextRequest("http://localhost/api/v1/contacts", { headers: { Authorization: "Bearer nope" } });
    const response = await getContacts(request);
    expect(response.status).toBe(401);
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });

  it("rejects a revoked or unknown key", async () => {
    mocks.authenticate.mockResolvedValueOnce(null);
    const response = await getTemplates(new NextRequest("http://localhost/api/v1/templates", { headers: bearer() }));
    expect(response.status).toBe(401);
    expect(((await response.json()) as { error: { message: string } }).error.message).toContain("revoked");
  });

  it("returns 429 with Retry-After and the rate-limit headers when the key is over its limit", async () => {
    mocks.consume.mockResolvedValueOnce({ allowed: false, limit: 60, remaining: 0, resetAt: Math.floor(Date.now() / 1000) + 30 });
    const response = await postMessage(jsonRequest("http://localhost/api/v1/messages", "POST", {}, { "Idempotency-Key": idempotencyKey }));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("rate_limited");
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/messages", () => {
  const url = "http://localhost/api/v1/messages";

  it("sends text through the shared send path with the key as actor and sets rate-limit headers", async () => {
    const response = await postMessage(jsonRequest(url, "POST", { to: "+91 98765 43210", type: "text", text: "Your order shipped" }, { "Idempotency-Key": idempotencyKey }));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("60");
    expect(await response.json()).toEqual({
      data: { id: "m1", wamId: "wamid.1", conversationId, type: "text", status: "sent", timestamp: "now" },
    });

    expect(mocks.ensureContact).toHaveBeenCalledWith(expect.objectContaining({ workspaceId, phoneNumber: "+919876543210" }));
    expect(mocks.send).toHaveBeenCalledWith({
      workspaceId,
      actorAuthUserId: `api_key:${keyId}`,
      idempotencyKey,
      body: expect.objectContaining({
        conversationId,
        recipientPhone: "919876543210",
        messageType: "text",
        text: "Your order shipped",
      }),
    });
  });

  it("requires a UUID Idempotency-Key before creating any contact or sending", async () => {
    const response = await postMessage(jsonRequest(url, "POST", { to: "+919876543210", text: "hi" }));
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("invalid_request");
    expect(mocks.ensureContact).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON and invalid recipients with a JSON error", async () => {
    const badJson = await postMessage(new NextRequest(url, {
      method: "POST", headers: bearer({ "Idempotency-Key": idempotencyKey }), body: "{not json",
    }));
    expect(badJson.status).toBe(400);
    expect(((await badJson.json()) as { error: { code: string } }).error.code).toBe("invalid_json");

    const badPhone = await postMessage(jsonRequest(url, "POST", { to: "12", text: "hi" }, { "Idempotency-Key": idempotencyKey }));
    expect(badPhone.status).toBe(400);
    expect(((await badPhone.json()) as { error: { message: string } }).error.message).toContain("to:");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("maps a closed 24-hour window to outside_24h_window", async () => {
    mocks.send.mockResolvedValueOnce({
      status: 403,
      body: { error: "WINDOW_EXPIRED", message: "The 24-hour customer care window has expired." },
    });
    const response = await postMessage(jsonRequest(url, "POST", { to: "+919876543210", text: "hi" }, { "Idempotency-Key": idempotencyKey }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "outside_24h_window", message: "The 24-hour customer care window has expired." },
    });
  });

  it("reports an uncertain provider outcome as 202 outcome_pending", async () => {
    mocks.send.mockResolvedValueOnce({
      status: 202,
      body: { success: false, status: "uncertain", error: "Outcome uncertain. Do not resend with a new key." },
    });
    const response = await postMessage(jsonRequest(url, "POST", { to: "+919876543210", text: "hi" }, { "Idempotency-Key": idempotencyKey }));
    expect(response.status).toBe(202);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("outcome_pending");
  });

  it("maps a template request to the template fields of the shared path", async () => {
    const response = await postMessage(jsonRequest(url, "POST", {
      to: "+919876543210",
      type: "template",
      template: { name: "order_update", language: "en_GB", variables: ["Asha", 42] },
    }, { "Idempotency-Key": idempotencyKey }));
    expect(response.status).toBe(200);
    expect(mocks.send.mock.calls[0][0].body).toEqual(expect.objectContaining({
      messageType: "template",
      templateName: "order_update",
      templateLanguage: "en_GB",
      templateVariables: ["Asha", "42"],
    }));
  });

  it("returns 503 when durable storage is not configured", async () => {
    mocks.durable.mockReturnValue(false);
    const response = await postMessage(jsonRequest(url, "POST", { to: "+919876543210", text: "hi" }, { "Idempotency-Key": idempotencyKey }));
    expect(response.status).toBe(503);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("returns a generic JSON 500 and does not leak internal messages", async () => {
    mocks.ensureContact.mockRejectedValueOnce(new Error("connection string leaked"));
    const response = await postMessage(jsonRequest(url, "POST", { to: "+919876543210", text: "hi" }, { "Idempotency-Key": idempotencyKey }));
    expect(response.status).toBe(500);
    const payload = (await response.json()) as { error: { code: string; message: string } };
    expect(payload.error.code).toBe("internal_error");
    expect(JSON.stringify(payload)).not.toContain("connection string");
  });
});

describe("/api/v1/contacts", () => {
  it("creates a contact with 201 and updates an existing one with 200", async () => {
    const contact = { id: "c1", phoneNumber: "+919876543210", name: "Asha" };
    mocks.upsertContact.mockResolvedValueOnce({ contact, created: true });
    const created = await postContact(jsonRequest("http://localhost/api/v1/contacts", "POST", {
      phoneNumber: "+91 98765 43210", name: "Asha", tags: ["vip"], customAttributes: { city: "Pune" },
    }));
    expect(created.status).toBe(201);
    expect(mocks.upsertContact).toHaveBeenCalledWith({
      workspaceId, phoneNumber: "+919876543210", name: "Asha", tags: ["vip"], customAttributes: { city: "Pune" },
    });

    mocks.upsertContact.mockResolvedValueOnce({ contact, created: false });
    const updated = await postContact(jsonRequest("http://localhost/api/v1/contacts", "POST", { phoneNumber: "+919876543210" }));
    expect(updated.status).toBe(200);
    expect(mocks.upsertContact).toHaveBeenLastCalledWith(expect.objectContaining({ name: undefined, tags: undefined }));
  });

  it("validates contact input before storing", async () => {
    const response = await postContact(jsonRequest("http://localhost/api/v1/contacts", "POST", {
      phoneNumber: "+919876543210", tags: "vip",
    }));
    expect(response.status).toBe(400);
    expect(mocks.upsertContact).not.toHaveBeenCalled();
  });

  it("pages contacts with an opaque cursor", async () => {
    const rows = [
      { id: "a0000000-0000-4000-8000-000000000001", createdAt: "2026-11-01T00:00:00.000000Z" },
      { id: "a0000000-0000-4000-8000-000000000002", createdAt: "2026-11-02T00:00:00.000000Z" },
      { id: "a0000000-0000-4000-8000-000000000003", createdAt: "2026-11-03T00:00:00.000000Z" },
    ];
    mocks.listContacts.mockResolvedValueOnce(rows);
    const response = await getContacts(new NextRequest("http://localhost/api/v1/contacts?limit=2", { headers: bearer() }));
    const payload = (await response.json()) as { data: unknown[]; nextCursor: string };
    expect(payload.data).toHaveLength(2);
    expect(decodeContactCursor(payload.nextCursor)).toEqual({
      ok: true,
      value: { createdAt: rows[1].createdAt, id: rows[1].id },
    });
    expect(mocks.listContacts).toHaveBeenCalledWith({ workspaceId, limit: 3, after: null });
  });

  it("rejects malformed cursors and limits", async () => {
    const badCursor = await getContacts(new NextRequest("http://localhost/api/v1/contacts?cursor=zzz", { headers: bearer() }));
    expect(badCursor.status).toBe(400);
    const badLimit = await getContacts(new NextRequest("http://localhost/api/v1/contacts?limit=500", { headers: bearer() }));
    expect(badLimit.status).toBe(400);
    expect(mocks.listContacts).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/templates", () => {
  it("returns Meta templates and filters by approval status", async () => {
    mocks.connection.mockResolvedValueOnce({ wabaId: "waba-1", accessToken: "token" });
    mocks.getTemplates.mockResolvedValueOnce([
      { name: "order_update", language: "en_GB", status: "APPROVED", category: "UTILITY", components: [{ type: "BODY" }] },
      { name: "promo", language: "en_US", status: "REJECTED", category: "MARKETING" },
    ]);
    const response = await getTemplates(new NextRequest("http://localhost/api/v1/templates?status=approved", { headers: bearer() }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [{ name: "order_update", language: "en_GB", category: "UTILITY", status: "APPROVED" }],
    });
  });

  it("answers 409 when the workspace has no connected WhatsApp account", async () => {
    mocks.connection.mockRejectedValueOnce(new Error("No connected WhatsApp Business Account for this workspace"));
    const response = await getTemplates(new NextRequest("http://localhost/api/v1/templates", { headers: bearer() }));
    expect(response.status).toBe(409);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("conflict");
  });
});

describe("request validation", () => {
  it("accepts a text message and a template message", () => {
    expect(parseSendRequest({ to: "+919876543210", text: " hello " })).toEqual({
      ok: true,
      value: { to: "919876543210", type: "text", text: "hello", templateName: "", templateLanguage: "en_US", templateVariables: [] },
    });
    expect(parseSendRequest({ to: "+919876543210", type: "template", template: { name: "order_update" } }).ok).toBe(true);
  });

  it("rejects empty text, unknown types, bad template names and oversized variables", () => {
    expect(parseSendRequest({ to: "+919876543210", text: "   " }).ok).toBe(false);
    expect(parseSendRequest({ to: "+919876543210", type: "image", text: "x" }).ok).toBe(false);
    expect(parseSendRequest({ to: "+919876543210", type: "template", template: { name: "Bad Name" } }).ok).toBe(false);
    expect(parseSendRequest({ to: "+919876543210", type: "template", template: { name: "ok", variables: ["x".repeat(1025)] } }).ok).toBe(false);
  });

  it("normalises phone numbers to digits between 8 and 15 long", () => {
    expect(normalizeRecipientPhone("+1 (415) 555-2671")).toEqual({ ok: true, value: "14155552671" });
    expect(normalizeRecipientPhone("1234567").ok).toBe(false);
    expect(normalizeRecipientPhone("1234567890123456").ok).toBe(false);
    expect(normalizeRecipientPhone(12345678901).ok).toBe(false);
  });

  it("round-trips contact cursors and rejects other values", () => {
    const cursor = encodeContactCursor("2026-11-01T00:00:00.000000Z", "a0000000-0000-4000-8000-000000000001");
    expect(decodeContactCursor(cursor).ok).toBe(true);
    expect(decodeContactCursor("").ok).toBe(true);
    expect(decodeContactCursor("c1.not-base64-json").ok).toBe(false);
    expect(parseLimit(null)).toEqual({ ok: true, value: 50 });
    expect(parseLimit("0").ok).toBe(false);
    expect(parseLimit("10.5").ok).toBe(false);
  });
});

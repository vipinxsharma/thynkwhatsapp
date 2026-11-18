import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), emit: vi.fn() }));

vi.mock("@neondatabase/serverless", () => ({ neon: () => ({ query: mocks.query }) }));
vi.mock("@/lib/developer/webhook-delivery", () => ({ emitWebhookEvent: mocks.emit }));

import {
  ensureContactConversation,
  recordMessage,
  updateMessageStatus,
  upsertContactByPhone,
} from "../lib/inbox/store";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const conversationId = "22222222-2222-4222-8222-222222222222";

const conversationRow = {
  conversationId,
  status: "open",
  phoneNumberId: "1234567890",
  windowExpiresAt: "2026-11-20T10:00:00.000Z",
  lastMessageAt: "2026-11-19T10:00:00.000Z",
  unreadCount: 1,
  assignedAuthUserId: null,
  id: "contact-1",
  waId: "919876543210",
  phoneNumber: "+919876543210",
  name: "Asha",
  tags: [],
  customAttributes: {},
  lastSeenAt: null,
  displayPhoneNumber: "+91 98765 00000",
  verifiedName: "Xeccel",
  lastMessage: null,
};

const messageRow = {
  id: "message-1",
  wamId: "wamid.inbound.1",
  direction: "inbound",
  type: "text",
  body: "Hello",
  rawPayload: {},
  status: "received",
  timestamp: "2026-11-19T10:00:00.000Z",
  conversationId,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_URL = "postgres://example.test/xeccel";
  mocks.emit.mockResolvedValue(undefined);
});

describe("inbox writes emit outbound webhook events", () => {
  it("queues message.received once for an inbound message, keyed by the message id", async () => {
    mocks.query
      .mockResolvedValueOnce([messageRow])
      .mockResolvedValueOnce([conversationRow]);

    await recordMessage(workspaceId, conversationId, {
      wamId: "wamid.inbound.1",
      direction: "inbound",
      type: "text",
      body: "Hello",
      rawPayload: {},
      status: "received",
      timestamp: "2026-11-19T10:00:00.000Z",
    });

    expect(mocks.emit).toHaveBeenCalledTimes(1);
    expect(mocks.emit).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId,
      eventType: "message.received",
      eventId: "message.received:message-1",
      data: expect.objectContaining({
        message: expect.objectContaining({ id: "message-1", wamId: "wamid.inbound.1", body: "Hello" }),
        contact: expect.objectContaining({ id: "contact-1", phoneNumber: "+919876543210" }),
      }),
    }));
  });

  it("does not emit message.received for an outbound message", async () => {
    mocks.query.mockResolvedValueOnce([{ ...messageRow, direction: "outbound", id: "message-2" }]);
    await recordMessage(workspaceId, conversationId, {
      wamId: "wamid.out.1",
      direction: "outbound",
      type: "text",
      body: "Hi",
      rawPayload: {},
      status: "sent",
      timestamp: "2026-11-19T10:00:00.000Z",
    });
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it("emits message.status_changed only when the status actually advanced", async () => {
    mocks.query.mockResolvedValueOnce([{ id: "message-3", wamId: "wamid.out.1", conversationId, direction: "outbound", type: "text" }]);
    await updateMessageStatus(workspaceId, "wamid.out.1", "delivered");
    expect(mocks.emit).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "message.status_changed",
      eventId: "message.status_changed:wamid.out.1:delivered",
    }));

    mocks.emit.mockClear();
    mocks.query.mockResolvedValueOnce([]);
    await updateMessageStatus(workspaceId, "wamid.out.1", "sent");
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it("emits contact.created only for a brand-new contact", async () => {
    mocks.query
      .mockResolvedValueOnce([{ id: "contact-1", created: true }])
      .mockResolvedValueOnce([{ id: conversationId }])
      .mockResolvedValueOnce([conversationRow]);
    await ensureContactConversation({ workspaceId, name: "Asha", phoneNumber: "+919876543210", phoneNumberId: "1234567890" });
    expect(mocks.emit).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "contact.created",
      eventId: "contact.created:contact-1",
    }));

    mocks.emit.mockClear();
    mocks.query
      .mockResolvedValueOnce([{ id: "contact-1", created: false }])
      .mockResolvedValueOnce([{ id: conversationId }])
      .mockResolvedValueOnce([conversationRow]);
    await ensureContactConversation({ workspaceId, name: "Asha", phoneNumber: "+919876543210", phoneNumberId: "1234567890" });
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it("upserts a contact by phone and emits contact.created only when it was inserted", async () => {
    const contact = {
      id: "contact-9", waId: "919876543210", phoneNumber: "+919876543210", name: "Ravi",
      tags: ["vip"], customAttributes: { city: "Pune" }, lastSeenAt: null, created: true,
    };
    mocks.query.mockResolvedValueOnce([contact]);
    const created = await upsertContactByPhone({
      workspaceId, phoneNumber: "+91 98765 43210", name: "Ravi", tags: ["vip"], customAttributes: { city: "Pune" },
    });
    expect(created.created).toBe(true);
    expect(created.contact).toMatchObject({ id: "contact-9", waId: "919876543210", phoneNumber: "+919876543210" });
    expect(mocks.emit).toHaveBeenCalledWith(expect.objectContaining({ eventType: "contact.created", eventId: "contact.created:contact-9" }));

    mocks.emit.mockClear();
    mocks.query.mockResolvedValueOnce([{ ...contact, created: false }]);
    const updated = await upsertContactByPhone({ workspaceId, phoneNumber: "+919876543210" });
    expect(updated.created).toBe(false);
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it("keeps stored tags unless the caller sends a tags list", async () => {
    mocks.query.mockResolvedValueOnce([{ id: "c", waId: "919876543210", phoneNumber: "+919876543210", name: "A", tags: [], customAttributes: {}, lastSeenAt: null, created: false }]);
    await upsertContactByPhone({ workspaceId, phoneNumber: "+919876543210", name: "" });
    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("CASE WHEN $8::boolean THEN $6::jsonb ELSE app_inbox_contacts.tags END");
    expect(params[7]).toBe(false);
  });

  it("rejects numbers outside the international length range before writing", async () => {
    await expect(upsertContactByPhone({ workspaceId, phoneNumber: "+12" })).rejects.toThrow("Invalid international phone number");
    expect(mocks.query).not.toHaveBeenCalled();
  });
});

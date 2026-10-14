import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  begin: vi.fn(),
  accept: vi.fn(),
  acceptedMessage: vi.fn(),
  send: vi.fn(),
  conversation: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: vi.fn(async () => ({ ok: true, session: { tenantId: "11111111-1111-4111-8111-111111111111", userId: "test-user", role: "owner" } })),
}));
vi.mock("@/lib/strapi/client", () => ({
  StrapiClient: class { constructor(_tenantId: string) {} },
  isDurableInboxEnabled: () => true,
}));
vi.mock("@/lib/inbox/store", () => ({ getConversation: mocks.conversation }));
vi.mock("@/lib/meta/connections", () => ({
  getMetaConnectionForWorkspace: vi.fn(async () => ({
    wabaId: "12345", phoneNumberId: "1234567890", accessToken: "test-token",
  })),
}));
vi.mock("@/lib/meta/client", () => ({
  MetaGraphClient: class {
    sendMessage = mocks.send;
  },
}));
vi.mock("@/lib/outbound/store", () => ({
  beginOutboundRequest: mocks.begin,
  acceptOutboundRequest: mocks.accept,
  getAcceptedMessage: mocks.acceptedMessage,
  hashOutboundRequest: () => "stable-hash",
  markOutboundUncertain: vi.fn(),
}));

import { POST } from "../app/api/whatsapp/messages/send/route";

const conversationId = "22222222-2222-4222-8222-222222222222";
const key = "33333333-3333-4333-8333-333333333333";
const accepted = {
  id: "44444444-4444-4444-8444-444444444444", wamId: "wamid.live.1",
  direction: "outbound", type: "text", body: "Hello", status: "sent",
  timestamp: new Date().toISOString(), conversationId,
};

function request() {
  return new NextRequest("http://localhost:3000/api/whatsapp/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({
      conversationId, recipientPhone: "+919876543210", messageType: "text", text: "Hello",
    }),
  });
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  mocks.conversation.mockResolvedValue({
    id: conversationId,
    contact: { waId: "919876543210" },
    phoneNumber: { phoneNumberId: "1234567890" },
    windowExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  mocks.send.mockResolvedValue({ messages: [{ id: accepted.wamId }] });
  mocks.accept.mockResolvedValue(accepted);
  mocks.acceptedMessage.mockResolvedValue(accepted);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("live outbound route", () => {
  it("calls Meta once when the same request ID is repeated", async () => {
    mocks.begin
      .mockResolvedValueOnce({ id: "55555555-5555-4555-8555-555555555555", createdNew: true, requestHash: "stable-hash", status: "sending", wamId: null })
      .mockResolvedValueOnce({ id: "55555555-5555-4555-8555-555555555555", createdNew: false, requestHash: "stable-hash", status: "accepted", wamId: accepted.wamId });

    const first = await POST(request());
    const replay = await POST(request());
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.accept).toHaveBeenCalledTimes(1);
  });

  it("does not call Meta while an earlier outcome is uncertain", async () => {
    mocks.begin.mockResolvedValue({ id: "55555555-5555-4555-8555-555555555555", createdNew: false, requestHash: "stable-hash", status: "uncertain", wamId: null });
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

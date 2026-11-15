import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), conversation: vi.fn(), page: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireApiSession: mocks.auth }));
vi.mock("@/lib/inbox/store", () => ({ getConversation: mocks.conversation, getMessagePage: mocks.page }));
vi.mock("@/lib/strapi/client", () => ({ isDurableInboxEnabled: () => true }));

import { GET } from "../app/api/inbox/messages/route";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const conversationId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ ok: true, session: { tenantId: workspaceId } });
  mocks.conversation.mockResolvedValue({ id: conversationId });
  mocks.page.mockResolvedValue({ messages: [], hasMore: false });
});

describe("inbox message paging", () => {
  it("refuses unauthenticated reads", async () => {
    mocks.auth.mockResolvedValueOnce({ ok: false, response: new Response("Unauthorized", { status: 401 }) });
    const response = await GET(new NextRequest(`http://localhost/api/inbox/messages?conversationId=${conversationId}`));
    expect(response.status).toBe(401);
    expect(mocks.page).not.toHaveBeenCalled();
  });

  it("requires a conversation owned by the active workspace", async () => {
    mocks.conversation.mockResolvedValueOnce(null);
    const response = await GET(new NextRequest(`http://localhost/api/inbox/messages?conversationId=${conversationId}`));
    expect(response.status).toBe(404);
    expect(mocks.conversation).toHaveBeenCalledWith(workspaceId, conversationId);
    expect(mocks.page).not.toHaveBeenCalled();
  });

  it("passes a validated keyset cursor to a bounded workspace query", async () => {
    const beforeId = "33333333-3333-4333-8333-333333333333";
    const timestamp = "2026-10-14T10:00:00.000Z";
    const params = new URLSearchParams({ conversationId, beforeId, beforeTimestamp: timestamp });
    const response = await GET(new NextRequest(`http://localhost/api/inbox/messages?${params}`));
    expect(response.status).toBe(200);
    expect(mocks.page).toHaveBeenCalledWith(workspaceId, conversationId, { id: beforeId, timestamp });
  });

  it("rejects incomplete or malformed cursors", async () => {
    const response = await GET(new NextRequest(
      `http://localhost/api/inbox/messages?conversationId=${conversationId}&beforeId=bad`,
    ));
    expect(response.status).toBe(400);
    expect(mocks.page).not.toHaveBeenCalled();
  });
});

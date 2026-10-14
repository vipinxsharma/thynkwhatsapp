import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@neondatabase/serverless", () => ({ neon: () => ({ query: mocks.query }) }));

import { getConversationForSender, getMessagePage } from "../lib/inbox/store";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgresql://test.invalid/db");
});

describe("bounded message history", () => {
  it("returns latest 50 in display order and reports an older page", async () => {
    mocks.query.mockResolvedValue(Array.from({ length: 51 }, (_, index) => ({
      id: `id-${50 - index}`, timestamp: `2026-10-14T10:00:${String(50 - index).padStart(2, "0")}.000000Z`,
    })));
    const page = await getMessagePage("workspace", "conversation");
    expect(page.messages).toHaveLength(50);
    expect(page.messages[0].id).toBe("id-1");
    expect(page.messages.at(-1)?.id).toBe("id-50");
    expect(page.hasMore).toBe(true);
    expect(mocks.query.mock.calls[0][0]).toContain("ORDER BY timestamp DESC, id DESC LIMIT 51");
    expect(mocks.query.mock.calls[0][1]).toEqual(["workspace", "conversation"]);
  });

  it("uses the workspace, conversation and precise timestamp/id cursor", async () => {
    mocks.query.mockResolvedValue([]);
    const cursor = { timestamp: "2026-10-14T10:00:00.123456Z", id: "message-id" };
    await getMessagePage("workspace", "conversation", cursor);
    expect(mocks.query.mock.calls[0][0]).toContain("(timestamp, id) < ($3::timestamptz, $4::uuid)");
    expect(mocks.query.mock.calls[0][1]).toEqual(["workspace", "conversation", cursor.timestamp, cursor.id]);
  });

  it("finds an inbound conversation by workspace, contact and sender channel", async () => {
    mocks.query.mockResolvedValue([]);
    expect(await getConversationForSender("workspace", "919876543210", "phone-id")).toBeNull();
    expect(mocks.query.mock.calls[0][0]).toContain("contact.wa_id = $2 AND c.phone_number_id = $3");
    expect(mocks.query.mock.calls[0][1]).toEqual(["workspace", "919876543210", "phone-id"]);
  });
});

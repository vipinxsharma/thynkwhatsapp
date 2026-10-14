import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ensureContactConversation,
  deleteContact,
  getMessages,
  listConversations,
  recordMessage,
  updateMessageStatus,
  updateContact,
} from "../lib/inbox/store";

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;

suite("durable inbox workspace isolation", () => {
  const workspaceA = randomUUID();
  const workspaceB = randomUUID();
  const sender = "+919876543210";
  const messageId = `wamid.test.${randomUUID()}`;

  beforeAll(async () => {
    const db = neon(process.env.TEST_DATABASE_URL!);
    await db.query(
      `INSERT INTO app_workspaces (id, name, slug, created_by_auth_user_id)
       VALUES ($1::uuid, 'Inbox A', $3, 'test'), ($2::uuid, 'Inbox B', $4, 'test')`,
      [workspaceA, workspaceB, `inbox-a-${workspaceA}`, `inbox-b-${workspaceB}`]
    );
  });

  afterAll(async () => {
    const db = neon(process.env.TEST_DATABASE_URL!);
    await db.query(`DELETE FROM app_workspaces WHERE id IN ($1::uuid, $2::uuid)`, [workspaceA, workspaceB]);
  });

  it("persists a new sender only in the selected workspace", async () => {
    const first = await ensureContactConversation({
      workspaceId: workspaceA, name: "Customer A", phoneNumber: sender,
      phoneNumberId: "1234567890", inbound: true,
    });
    const second = await ensureContactConversation({
      workspaceId: workspaceB, name: "Customer B", phoneNumber: sender,
      phoneNumberId: "1234567890", inbound: true,
    });
    expect(first.created).toBe(true);
    expect(second.created).toBe(true);
    expect(first.conversation.id).not.toBe(second.conversation.id);
    expect((await listConversations(workspaceA)).map((item) => item.contact.name)).toEqual(["Customer A"]);
    expect((await listConversations(workspaceB)).map((item) => item.contact.name)).toEqual(["Customer B"]);

    const input = {
      wamId: messageId, direction: "inbound" as const, type: "text" as const,
      body: "Hello", status: "received" as const, timestamp: new Date().toISOString(),
    };
    const recorded = await recordMessage(workspaceA, String(first.conversation.id), input);
    const duplicate = await recordMessage(workspaceA, String(first.conversation.id), input);
    expect(duplicate.id).toBe(recorded.id);
    expect(await getMessages(workspaceA, String(first.conversation.id))).toHaveLength(1);
    const refreshed = (await listConversations(workspaceA))[0];
    expect(refreshed.unreadCount).toBe(1);
    expect(new Date(refreshed.windowExpiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(await getMessages(workspaceB, String(second.conversation.id))).toHaveLength(0);
    await expect(recordMessage(workspaceB, String(first.conversation.id), input)).rejects.toThrow();

    await updateMessageStatus(workspaceA, messageId, "delivered");
    await updateMessageStatus(workspaceA, messageId, "sent");
    expect((await getMessages(workspaceA, String(first.conversation.id)))[0].status).toBe("delivered");

    const updated = await updateContact(workspaceA, String(first.contact.id), {
      name: "Renamed Customer", tags: ["Priority"],
    });
    expect(updated).toMatchObject({ name: "Renamed Customer", tags: ["Priority"] });
    expect((await listConversations(workspaceB))[0].contact.name).toBe("Customer B");
    expect(await deleteContact(workspaceB, String(first.contact.id))).toBe(false);
    expect(await deleteContact(workspaceB, String(second.contact.id))).toBe(true);
    expect(await listConversations(workspaceB)).toHaveLength(0);
  });
});

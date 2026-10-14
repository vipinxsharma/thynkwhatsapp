import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getMessageUsage, parseUsageRange } from "../lib/analytics/message-usage";

describe("usage range", () => {
  it("accepts only supported periods", () => {
    expect(parseUsageRange("7d")).toBe("7d");
    expect(parseUsageRange("90d")).toBe("90d");
    expect(parseUsageRange("365d")).toBe("30d");
  });

  it("does not return a fabricated zero when storage is unavailable", async () => {
    const storage = process.env.INBOX_STORAGE;
    process.env.INBOX_STORAGE = "memory";
    try {
      await expect(getMessageUsage(randomUUID(), "7d")).rejects.toThrow("not configured");
    } finally {
      if (storage === undefined) delete process.env.INBOX_STORAGE;
      else process.env.INBOX_STORAGE = storage;
    }
  });
});

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;

suite("workspace-scoped message usage", () => {
  const first = randomUUID();
  const second = randomUUID();
  const firstContact = randomUUID();
  const secondContact = randomUUID();
  const firstConversation = randomUUID();
  const secondConversation = randomUUID();

  beforeAll(async () => {
    const db = neon(process.env.TEST_DATABASE_URL!);
    await db.query(
      `INSERT INTO app_workspaces (id, name, slug, created_by_auth_user_id)
       VALUES ($1::uuid, 'Usage A', $3, 'test'), ($2::uuid, 'Usage B', $4, 'test')`,
      [first, second, `usage-a-${first}`, `usage-b-${second}`]
    );
    await db.query(
      `INSERT INTO app_inbox_contacts (id, workspace_id, wa_id, phone_number, name)
       VALUES ($1::uuid, $2::uuid, $3, '+911111111111', 'A'),
              ($4::uuid, $5::uuid, $6, '+912222222222', 'B')`,
      [firstContact, first, `usage-${first}`, secondContact, second, `usage-${second}`]
    );
    await db.query(
      `INSERT INTO app_inbox_conversations (id, workspace_id, contact_id)
       VALUES ($1::uuid, $2::uuid, $3::uuid), ($4::uuid, $5::uuid, $6::uuid)`,
      [firstConversation, first, firstContact, secondConversation, second, secondContact]
    );
    await db.query(
      `INSERT INTO app_inbox_messages (id, workspace_id, conversation_id, wam_id, direction, type, body, status, timestamp)
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, 'inbound', 'text', 'hi', 'received', now()),
              (gen_random_uuid(), $1::uuid, $2::uuid, $4, 'outbound', 'text', 'hello', 'read', now()),
              (gen_random_uuid(), $5::uuid, $6::uuid, $7, 'outbound', 'text', 'other', 'failed', now())`,
      [first, firstConversation, `usage-in-${first}`, `usage-out-${first}`, second, secondConversation, `usage-out-${second}`]
    );
  });

  afterAll(async () => {
    const db = neon(process.env.TEST_DATABASE_URL!);
    await db.query(`DELETE FROM app_workspaces WHERE id IN ($1::uuid, $2::uuid)`, [first, second]);
  });

  it("counts only the selected workspace and reconciles directions", async () => {
    const oldStorage = process.env.INBOX_STORAGE;
    const oldDatabase = process.env.DATABASE_URL;
    process.env.INBOX_STORAGE = "postgres";
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    try {
      expect(await getMessageUsage(first, "7d")).toMatchObject({
        total: 2, inbound: 1, outbound: 1, delivered: 1, read: 1, failed: 0,
      });
      expect(await getMessageUsage(second, "7d")).toMatchObject({
        total: 1, inbound: 0, outbound: 1, delivered: 0, read: 0, failed: 1,
      });
    } finally {
      if (oldStorage === undefined) delete process.env.INBOX_STORAGE;
      else process.env.INBOX_STORAGE = oldStorage;
      if (oldDatabase === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = oldDatabase;
    }
  });
});

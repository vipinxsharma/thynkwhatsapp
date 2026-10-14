import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureContactConversation, getMessages } from "../lib/inbox/store";
import {
  acceptOutboundRequest,
  beginOutboundRequest,
  getAcceptedMessage,
  hashOutboundRequest,
  markOutboundUncertain,
} from "../lib/outbound/store";

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;

suite("outbound idempotency ledger", () => {
  const workspaceId = randomUUID();
  const key = randomUUID();
  let conversationId: string;
  const payload = { messaging_product: "whatsapp" as const, to: "919876543210", type: "text" as const, text: { body: "Hello" } };

  beforeAll(async () => {
    const db = neon(process.env.TEST_DATABASE_URL!);
    await db.query(
      `INSERT INTO app_workspaces (id, name, slug, created_by_auth_user_id)
       VALUES ($1::uuid, 'Outbound Test', $2, 'test')`,
      [workspaceId, `outbound-${workspaceId}`]
    );
    const created = await ensureContactConversation({
      workspaceId, name: "Customer", phoneNumber: "+919876543210", phoneNumberId: "1234567890",
    });
    conversationId = String(created.conversation.id);
  });

  afterAll(async () => {
    const db = neon(process.env.TEST_DATABASE_URL!);
    await db.query(`DELETE FROM app_workspaces WHERE id = $1::uuid`, [workspaceId]);
  });

  it("reserves a provider call once and atomically records its accepted message", async () => {
    const requestHash = hashOutboundRequest({ conversationId, phoneNumberId: "1234567890", recipientWaId: payload.to, payload });
    const input = {
      workspaceId, conversationId, idempotencyKey: key, requestHash,
      authUserId: "test-user", phoneNumberId: "1234567890", recipientWaId: payload.to,
      messageType: "text", messageBody: "Hello", payload,
    };
    const first = await beginOutboundRequest(input);
    const duplicate = await beginOutboundRequest(input);
    expect(first.createdNew).toBe(true);
    expect(duplicate.createdNew).toBe(false);
    expect(duplicate.id).toBe(first.id);
    const changedPayload = { ...payload, text: { body: "Different message" } };
    const changedHash = hashOutboundRequest({
      conversationId, phoneNumberId: "1234567890", recipientWaId: payload.to, payload: changedPayload,
    });
    const conflicting = await beginOutboundRequest({ ...input, requestHash: changedHash, payload: changedPayload });
    expect(conflicting.createdNew).toBe(false);
    expect(conflicting.requestHash).not.toBe(changedHash);

    const wamId = `wamid.test.${randomUUID()}`;
    const accepted = await acceptOutboundRequest({ workspaceId, requestId: first.id, wamId });
    expect(accepted).toMatchObject({ wamId, direction: "outbound", status: "sent" });
    expect((await getAcceptedMessage(workspaceId, wamId))?.id).toBe(accepted.id);
    expect(await getMessages(workspaceId, conversationId)).toHaveLength(1);
    const replay = await beginOutboundRequest(input);
    expect(replay).toMatchObject({ createdNew: false, status: "accepted", wamId });
    await expect(acceptOutboundRequest({ workspaceId, requestId: first.id, wamId })).rejects.toThrow();
  });

  it("keeps an uncertain outcome from being reserved again", async () => {
    const idempotencyKey = randomUUID();
    const requestHash = hashOutboundRequest({ conversationId, phoneNumberId: "1234567890", recipientWaId: payload.to, payload });
    const input = {
      workspaceId, conversationId, idempotencyKey, requestHash,
      authUserId: "test-user", phoneNumberId: "1234567890", recipientWaId: payload.to,
      messageType: "text", messageBody: "Hello", payload,
    };
    const first = await beginOutboundRequest(input);
    await markOutboundUncertain(workspaceId, first.id);
    const retry = await beginOutboundRequest(input);
    expect(retry).toMatchObject({ createdNew: false, status: "uncertain" });
  });
});

import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import crypto from "crypto";
import { verifyMetaWebhookSignature } from "../lib/meta/signature";
import { encryptToken, decryptToken } from "../lib/meta/encryption";
import { GET, POST } from "../app/api/webhooks/meta/route";
import { NextRequest } from "next/server";
import { StrapiClient } from "../lib/strapi/client";

const TEST_META_SECRET = "my_meta_app_secret_test_123";
const TEST_VERIFY_TOKEN = "test_webhook_verify_token";

beforeEach(() => {
  vi.stubEnv("META_APP_SECRET", TEST_META_SECRET);
  vi.stubEnv("META_WEBHOOK_VERIFY_TOKEN", TEST_VERIFY_TOKEN);
  vi.stubEnv("META_WEBHOOK_TENANT_ID", "webhook-test-tenant");
  vi.stubEnv("ENCRYPTION_KEY", "test-encryption-key-with-at-least-32-characters");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Meta Webhook Cryptographic Verification", () => {
  const secret = TEST_META_SECRET;
  const rawBody = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

  it("should validate a authentic HMAC-SHA256 signature", () => {
    const validHex = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    const header = `sha256=${validHex}`;

    const isValid = verifyMetaWebhookSignature(rawBody, header, secret);
    expect(isValid).toBe(true);
  });

  it("should reject a tampered payload", () => {
    const validHex = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    const header = `sha256=${validHex}`;

    const tamperedBody = JSON.stringify({ object: "tampered_account", entry: [] });
    const isValid = verifyMetaWebhookSignature(tamperedBody, header, secret);
    expect(isValid).toBe(false);
  });

  it("should reject invalid signature formats", () => {
    expect(verifyMetaWebhookSignature(rawBody, null, secret)).toBe(false);
    expect(verifyMetaWebhookSignature(rawBody, "invalid_header", secret)).toBe(false);
    expect(verifyMetaWebhookSignature(rawBody, "sha1=abcdef", secret)).toBe(false);
  });
});

describe("AES-256-GCM Token Encryption", () => {
  it("should encrypt and decrypt a Meta system token correctly", () => {
    const rawToken = "EAABwzLIXs44BA0123456789LongLivedSystemTokenForWhatsApp";
    const encrypted = encryptToken(rawToken);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();
    expect(encrypted.ciphertext).not.toBe(rawToken);

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(rawToken);
  });

  it("fails closed when the encryption key is not configured", () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    expect(() => encryptToken("sensitive-token")).toThrow(
      "ENCRYPTION_KEY must contain at least 32 characters"
    );
  });
});

describe("GET /api/webhooks/meta (Challenge Verification)", () => {
  it("should return challenge string with 200 OK when tokens match", async () => {
    const challenge = "1158201444";
    const url = `http://localhost:3000/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=${TEST_VERIFY_TOKEN}&hub.challenge=${challenge}`;

    const req = new NextRequest(url);
    const res = await GET(req);

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe(challenge);
  });

  it("should return 403 when verify token is incorrect", async () => {
    const url = `http://localhost:3000/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=12345`;
    const req = new NextRequest(url);
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it("should fail closed when the verification token is not configured", async () => {
    vi.stubEnv("META_WEBHOOK_VERIFY_TOKEN", "");
    const url = "http://localhost:3000/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=anything&hub.challenge=12345";
    const res = await GET(new NextRequest(url));

    expect(res.status).toBe(503);
  });
});

describe("POST /api/webhooks/meta (Incoming Message Ingestion)", () => {
  const emptyWebhookBody = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

  function signedWebhook(payload: unknown): NextRequest {
    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", TEST_META_SECRET).update(rawBody, "utf8").digest("hex");
    return new NextRequest("http://localhost:3000/api/webhooks/meta", {
      method: "POST",
      body: rawBody,
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": `sha256=${signature}`,
      },
    });
  }

  function inboundPayload(sender: string, messageId: string) {
    return {
      object: "whatsapp_business_account",
      entry: [{
        id: "109823485723910",
        changes: [{
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "+91 98765 43210", phone_number_id: "105678234901234" },
            contacts: [{ profile: { name: "New Customer" }, wa_id: sender }],
            messages: [{ from: sender, id: messageId, timestamp: Math.floor(Date.now() / 1000).toString(), type: "text", text: { body: "hi" } }],
          },
        }],
      }],
    };
  }

  it("should accept valid WhatsApp webhook payload and return 200", async () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "109823485723910",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "+91 98765 43210",
                  phone_number_id: "105678234901234",
                },
                contacts: [
                  {
                    profile: { name: "Test Lead" },
                    wa_id: "919820011223",
                  },
                ],
                messages: [
                  {
                    from: "919820011223",
                    id: `wamid.TEST_${Date.now()}`,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: "text",
                    text: { body: "Automated test message" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha256", TEST_META_SECRET)
      .update(rawBody, "utf8")
      .digest("hex");
    const req = new NextRequest("http://localhost:3000/api/webhooks/meta", {
      method: "POST",
      body: rawBody,
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": `sha256=${signature}`,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("should reject a webhook without a valid signature", async () => {
    const req = new NextRequest("http://localhost:3000/api/webhooks/meta", {
      method: "POST",
      body: emptyWebhookBody,
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("creates a separate conversation for a new sender and does not invent a bot delivery", async () => {
    const client = new StrapiClient("webhook-test-tenant");
    const before = await client.getConversations();
    const unrelatedId = before[0].id;
    const sender = "919876500001";
    const messageId = `wamid.NEW_${Date.now()}`;

    const response = await POST(signedWebhook(inboundPayload(sender, messageId)));
    expect(response.status).toBe(200);

    const conversations = await client.getConversations();
    const created = conversations.find((conversation) => conversation.contact.waId === sender);
    expect(created).toBeDefined();
    expect(created?.id).not.toBe(unrelatedId);
    const messages = await client.getMessages(created!.id);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ wamId: messageId, direction: "inbound" });
    expect((await client.getMessages(unrelatedId)).some((message) => message.wamId === messageId)).toBe(false);
  });

  it("does not acknowledge an ingestion failure as success", async () => {
    vi.spyOn(StrapiClient.prototype, "recordMessage").mockRejectedValueOnce(new Error("storage unavailable"));
    const response = await POST(signedWebhook(inboundPayload("919876500002", `wamid.FAIL_${Date.now()}`)));
    expect(response.status).toBe(500);
  });

  it("rejects live webhook ingestion until durable storage exists", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await POST(signedWebhook(inboundPayload("919876500003", `wamid.PROD_${Date.now()}`)));
    expect(response.status).toBe(503);
  });

  it("should fail closed when webhook signing is not configured", async () => {
    vi.stubEnv("META_APP_SECRET", "");
    const req = new NextRequest("http://localhost:3000/api/webhooks/meta", {
      method: "POST",
      body: emptyWebhookBody,
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
  });
});

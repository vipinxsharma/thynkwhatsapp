import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyMetaWebhookSignature } from "../lib/meta/signature";
import { encryptToken, decryptToken } from "../lib/meta/encryption";
import { GET, POST } from "../app/api/webhooks/meta/route";
import { NextRequest } from "next/server";

describe("Meta Webhook Cryptographic Verification", () => {
  const secret = "my_meta_app_secret_test_123";
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
});

describe("GET /api/webhooks/meta (Challenge Verification)", () => {
  it("should return challenge string with 200 OK when tokens match", async () => {
    const challenge = "1158201444";
    const verifyToken = "thynkwise_meta_verify_token_secure_2026";
    const url = `http://localhost:3000/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=${challenge}`;

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
});

describe("POST /api/webhooks/meta (Incoming Message Ingestion)", () => {
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

    const req = new NextRequest("http://localhost:3000/api/webhooks/meta", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});

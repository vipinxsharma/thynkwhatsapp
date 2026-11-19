import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@neondatabase/serverless", () => ({ neon: () => ({ query: mocks.query }) }));
vi.mock("@/lib/developer/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/developer/db")>();
  return { ...actual, developerDatabase: () => ({ query: mocks.query }) };
});

import {
  MAX_WEBHOOK_ATTEMPTS,
  generateSigningSecret,
  signWebhookPayload,
  validateWebhookEvents,
  validateWebhookUrl,
  verifyWebhookSignature,
  webhookRetryDelayMs,
  WEBHOOK_SIGNATURE_HEADER,
} from "../lib/developer/webhook-signing";
import { attemptDelivery, buildWebhookEnvelope } from "../lib/developer/webhook-delivery";
import { saveWebhookConfig, openSigningSecret } from "../lib/developer/webhook-store";

const secret = "whsec_test_secret_for_unit_tests_only";
const body = JSON.stringify({ id: "message.received:abc", type: "message.received", data: { ok: true } });
const workspaceId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_URL = "postgres://example.test/xeccel";
  process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef-test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("webhook signing", () => {
  it("verifies a payload signed with the same secret", () => {
    const now = 1_800_000_000;
    const header = signWebhookPayload({ secret, body, timestampSeconds: now });
    expect(header).toMatch(/^t=1800000000,v1=[0-9a-f]{64}$/);
    expect(verifyWebhookSignature({ secret, body, header, nowSeconds: now })).toBe(true);
  });

  it("rejects a changed body, a different secret and a missing header", () => {
    const now = 1_800_000_000;
    const header = signWebhookPayload({ secret, body, timestampSeconds: now });
    expect(verifyWebhookSignature({ secret, body: body.replace("true", "false"), header, nowSeconds: now })).toBe(false);
    expect(verifyWebhookSignature({ secret: "whsec_other", body, header, nowSeconds: now })).toBe(false);
    expect(verifyWebhookSignature({ secret, body, header: undefined, nowSeconds: now })).toBe(false);
  });

  it("rejects signatures outside the tolerance window to limit replay", () => {
    const signedAt = 1_800_000_000;
    const header = signWebhookPayload({ secret, body, timestampSeconds: signedAt });
    expect(verifyWebhookSignature({ secret, body, header, nowSeconds: signedAt + 300 })).toBe(true);
    expect(verifyWebhookSignature({ secret, body, header, nowSeconds: signedAt + 301 })).toBe(false);
    expect(verifyWebhookSignature({ secret, body, header, nowSeconds: signedAt - 301 })).toBe(false);
  });

  it("accepts any listed v1 signature so a secret can be rotated without dropping deliveries", () => {
    const now = 1_800_000_000;
    const old = signWebhookPayload({ secret: "whsec_old", body, timestampSeconds: now });
    const current = signWebhookPayload({ secret, body, timestampSeconds: now });
    const oldSig = old.split("v1=")[1];
    const currentSig = current.split("v1=")[1];
    expect(verifyWebhookSignature({ secret, body, header: `t=${now},v1=${oldSig},v1=${currentSig}`, nowSeconds: now })).toBe(true);
  });

  it("rejects malformed headers", () => {
    const now = 1_800_000_000;
    for (const header of ["", "garbage", `t=${now}`, `v1=${"0".repeat(64)}`, `t=abc,v1=${"0".repeat(64)}`, `t=${now},v1=short`]) {
      expect(verifyWebhookSignature({ secret, body, header, nowSeconds: now })).toBe(false);
    }
  });

  it("generates distinct prefixed signing secrets", () => {
    const first = generateSigningSecret();
    expect(first.startsWith("whsec_")).toBe(true);
    expect(first.length).toBeGreaterThan(40);
    expect(generateSigningSecret()).not.toBe(first);
    expect(generateSigningSecret(() => Buffer.alloc(32, 1))).toBe(generateSigningSecret(() => Buffer.alloc(32, 1)));
  });

  it("uses the documented header name", () => {
    expect(WEBHOOK_SIGNATURE_HEADER).toBe("X-Xeccel-Signature");
  });
});

describe("retry schedule", () => {
  it("backs off from 30 seconds up to six hours and allows six attempts in total", () => {
    expect(MAX_WEBHOOK_ATTEMPTS).toBe(6);
    expect(webhookRetryDelayMs(1)).toBe(30_000);
    expect(webhookRetryDelayMs(2)).toBe(120_000);
    expect(webhookRetryDelayMs(3)).toBe(600_000);
    expect(webhookRetryDelayMs(4)).toBe(3_600_000);
    expect(webhookRetryDelayMs(5)).toBe(21_600_000);
    expect(webhookRetryDelayMs(9)).toBe(21_600_000);
    expect(webhookRetryDelayMs(0)).toBe(30_000);
  });
});

describe("validation", () => {
  it("accepts only known, non-empty event lists", () => {
    expect(validateWebhookEvents(["message.received", "contact.created", "message.received"])).toEqual({
      ok: true,
      events: ["message.received", "contact.created"],
    });
    expect(validateWebhookEvents([]).ok).toBe(false);
    expect(validateWebhookEvents("message.received").ok).toBe(false);
    expect(validateWebhookEvents(["message.received", "user.deleted"])).toEqual({
      ok: false,
      error: "Unknown events: user.deleted",
    });
  });

  it("accepts https endpoints and rejects other schemes, credentials and private hosts", () => {
    const prod = { allowLocalHttp: false };
    expect(validateWebhookUrl("https://example.com/hook", prod).ok).toBe(true);
    expect(validateWebhookUrl("https://fdic.gov/hook", prod).ok).toBe(true);
    expect(validateWebhookUrl("http://example.com/hook", prod).ok).toBe(false);
    expect(validateWebhookUrl("ftp://example.com/hook", prod).ok).toBe(false);
    expect(validateWebhookUrl("https://user:secret@example.com/hook", prod).ok).toBe(false);
    expect(validateWebhookUrl("not a url", prod).ok).toBe(false);
    expect(validateWebhookUrl("", prod).ok).toBe(false);
    expect(validateWebhookUrl("https://localhost/hook", prod).ok).toBe(false);
    expect(validateWebhookUrl("https://10.0.0.5/hook", prod).ok).toBe(false);
    expect(validateWebhookUrl("https://192.168.1.20/hook", prod).ok).toBe(false);
    expect(validateWebhookUrl("https://172.20.1.1/hook", prod).ok).toBe(false);
    expect(validateWebhookUrl("https://169.254.169.254/latest", prod).ok).toBe(false);
    expect(validateWebhookUrl("https://[::1]/hook", prod).ok).toBe(false);
  });

  it("allows plain http only for local hosts in development", () => {
    const dev = { allowLocalHttp: true };
    expect(validateWebhookUrl("http://localhost:3000/hook", dev).ok).toBe(true);
    expect(validateWebhookUrl("http://example.com/hook", dev).ok).toBe(false);
  });
});

describe("webhook subscription store", () => {
  it("stores the signing secret encrypted and returns it only when the subscription is created", async () => {
    mocks.query.mockResolvedValueOnce([
      { id: "e1", url: "https://example.com/hook", events: ["message.received"], enabled: true,
        createdAt: "now", updatedAt: "now", created: true },
    ]);
    const result = await saveWebhookConfig({
      workspaceId, authUserId: "user-1", url: "https://example.com/hook",
      events: ["message.received"], enabled: true,
    });
    expect(result.signingSecret).toMatch(/^whsec_/);
    expect(result.config).not.toHaveProperty("created");

    const [, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(params).not.toContain(result.signingSecret);
    const sealed = { ciphertext: params[5] as string, iv: params[6] as string, tag: params[7] as string };
    expect(openSigningSecret(sealed)).toBe(result.signingSecret);
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("app_audit_logs"))).toBe(true);
  });

  it("keeps the existing secret on update and returns none", async () => {
    mocks.query.mockResolvedValueOnce([
      { id: "e1", url: "https://example.com/new", events: ["contact.created"], enabled: true,
        createdAt: "now", updatedAt: "now", created: false },
    ]);
    const result = await saveWebhookConfig({
      workspaceId, authUserId: "user-1", url: "https://example.com/new",
      events: ["contact.created"], enabled: true,
    });
    expect(result.signingSecret).toBeNull();
    expect(result.config.url).toBe("https://example.com/new");
    const [sql] = mocks.query.mock.calls[0] as [string];
    expect(sql).toContain("ON CONFLICT (workspace_id)");
    expect(sql).not.toContain("encrypted_secret = EXCLUDED");
  });
});

describe("event envelope", () => {
  it("builds a stable envelope with the event id, type and workspace", () => {
    const envelope = buildWebhookEnvelope({
      eventId: "contact.created:c1", eventType: "contact.created", workspaceId,
      data: { contact: { id: "c1" } }, now: new Date("2026-11-19T10:00:00.000Z"),
    });
    expect(envelope).toEqual({
      id: "contact.created:c1",
      type: "contact.created",
      createdAt: "2026-11-19T10:00:00.000Z",
      workspaceId,
      data: { contact: { id: "c1" } },
    });
  });
});

describe("delivery attempts", () => {
  const delivery = {
    id: "d1",
    workspace_id: workspaceId,
    endpoint_id: "e1",
    event_id: "message.received:abc",
    event_type: "message.received",
    payload: JSON.parse(body) as Record<string, unknown>,
    attempts: 1,
    url: "https://example.com/hook",
    encryptedSecret: "",
    secretIv: "",
    secretTag: "",
  };

  beforeEach(() => {
    mocks.query.mockResolvedValue([]);
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("signs the exact body it sends and records a delivered status on a 2xx response", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response("ok", { status: 202 }));
    const { encryptedSecret, secretIv, secretTag } = await sealSecretForTest(secret);

    const outcome = await attemptDelivery({ ...delivery, encryptedSecret, secretIv, secretTag });
    expect(outcome).toBe("delivered");

    const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/hook");
    expect(init.redirect).toBe("manual");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Xeccel-Event"]).toBe("message.received");
    expect(headers["X-Xeccel-Event-Id"]).toBe("message.received:abc");
    expect(init.body).toBe(body);
    const signature = headers[WEBHOOK_SIGNATURE_HEADER];
    expect(verifyWebhookSignature({
      secret, body: String(init.body), header: signature, nowSeconds: Math.floor(Date.now() / 1000),
    })).toBe(true);

    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("status = 'delivered'");
    expect(params).toEqual(["d1", 202]);
  });

  it("schedules a retry with the first backoff step after a non-2xx response", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    const { encryptedSecret, secretIv, secretTag } = await sealSecretForTest(secret);
    const outcome = await attemptDelivery({ ...delivery, attempts: 1, encryptedSecret, secretIv, secretTag });
    expect(outcome).toBe("retrying");
    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("next_attempt_at");
    expect(params).toEqual(["d1", "pending", 500, "Endpoint responded with HTTP 500", 30_000]);
  });

  it("marks the delivery failed once the attempt budget is spent", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    const { encryptedSecret, secretIv, secretTag } = await sealSecretForTest(secret);
    const outcome = await attemptDelivery({ ...delivery, attempts: MAX_WEBHOOK_ATTEMPTS, encryptedSecret, secretIv, secretTag });
    expect(outcome).toBe("failed");
    const [, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(params[1]).toBe("failed");
    expect(params[3]).toBe("connect ECONNREFUSED");
  });

  it("never sends a body when the stored secret cannot be opened", async () => {
    const outcome = await attemptDelivery({ ...delivery, encryptedSecret: "bad", secretIv: "bad", secretTag: "bad" });
    expect(outcome).toBe("retrying");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

// Seals a secret with the real encryption helper so attemptDelivery can open it.
async function sealSecretForTest(value: string) {
  const { encryptToken } = await import("../lib/meta/encryption");
  const sealed = encryptToken(value);
  return { encryptedSecret: sealed.ciphertext, secretIv: sealed.iv, secretTag: sealed.authTag };
}

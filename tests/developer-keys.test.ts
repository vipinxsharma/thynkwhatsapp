import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@neondatabase/serverless", () => ({ neon: () => ({ query: mocks.query }) }));

import {
  API_KEY_PREFIX,
  generateApiKey,
  hashApiKey,
  isWellFormedApiKey,
  parseBearerToken,
} from "../lib/developer/keys";
import { authenticateApiKey, createApiKey, revokeApiKey } from "../lib/developer/api-key-store";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const userId = "auth-user-1";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_URL = "postgres://example.test/xeccel";
});

describe("API key generation and hashing", () => {
  it("generates a prefixed key whose visible prefix is a slice of the key", () => {
    const generated = generateApiKey();
    expect(generated.key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(isWellFormedApiKey(generated.key)).toBe(true);
    expect(generated.key.startsWith(generated.prefix)).toBe(true);
    expect(generated.prefix.length).toBe(API_KEY_PREFIX.length + 4);
  });

  it("stores only a SHA-256 hash of the full key, never the key itself", () => {
    const generated = generateApiKey();
    expect(generated.hash).toBe(createHash("sha256").update(generated.key).digest("hex"));
    expect(generated.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(generated.hash).not.toContain(generated.key);
    expect(hashApiKey(generated.key)).toBe(generated.hash);
  });

  it("produces different keys each time and uses injected randomness when given", () => {
    expect(generateApiKey().key).not.toBe(generateApiKey().key);
    const fixed = generateApiKey(() => Buffer.alloc(32, 7));
    expect(fixed.key).toBe(generateApiKey(() => Buffer.alloc(32, 7)).key);
  });

  it("rejects malformed keys before any lookup", () => {
    expect(isWellFormedApiKey("xk_live_short")).toBe(false);
    expect(isWellFormedApiKey("sk_live_" + "A".repeat(43))).toBe(false);
    expect(isWellFormedApiKey(`${API_KEY_PREFIX}${"A".repeat(42)}!`)).toBe(false);
  });
});

describe("bearer token parsing", () => {
  it("reads the token from a Bearer header", () => {
    expect(parseBearerToken("Bearer abc.def")).toBe("abc.def");
    expect(parseBearerToken("bearer   token-value ")).toBe("token-value");
  });

  it("returns null for other schemes, empty values and missing headers", () => {
    expect(parseBearerToken(null)).toBeNull();
    expect(parseBearerToken("Basic dXNlcjpwYXNz")).toBeNull();
    expect(parseBearerToken("Bearer")).toBeNull();
    expect(parseBearerToken("Bearer two tokens")).toBeNull();
  });
});

describe("API key store", () => {
  it("writes the hash, never the plain key, and returns the key once", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO app_api_keys")) {
        return [{ id: "k1", name: "Orders", prefix: "x", createdAt: "now", lastUsedAt: null, revokedAt: null }];
      }
      return [];
    });

    const created = await createApiKey({ workspaceId, authUserId: userId, name: "Orders" });
    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("key_hash");
    expect(params).toContain(hashApiKey(created.key));
    expect(params.some((value) => value === created.key)).toBe(false);
    expect(created.key.startsWith(API_KEY_PREFIX)).toBe(true);
  });

  it("writes an audit row when a key is created and when it is revoked", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO app_api_keys")) {
        return [{ id: "k1", name: "Orders", prefix: "xk_live_ab", createdAt: "now", lastUsedAt: null, revokedAt: null }];
      }
      if (sql.includes("UPDATE app_api_keys SET revoked_at")) {
        return [{ id: "k1", name: "Orders", prefix: "xk_live_ab" }];
      }
      return [];
    });
    await createApiKey({ workspaceId, authUserId: userId, name: "Orders" });
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("app_audit_logs"))).toBe(true);

    mocks.query.mockClear();
    expect(await revokeApiKey({ workspaceId, authUserId: userId, keyId: "k1" })).toBe(true);
    const auditCall = mocks.query.mock.calls.find(([sql]) => String(sql).includes("app_audit_logs"));
    expect(auditCall?.[1]).toContain("api_key.revoked");
  });

  it("does not revoke a key that is already revoked or belongs to another workspace", async () => {
    mocks.query.mockResolvedValue([]);
    expect(await revokeApiKey({ workspaceId, authUserId: userId, keyId: "k1" })).toBe(false);
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("app_audit_logs"))).toBe(false);
  });

  it("authenticates by hash, so a revoked or unknown key resolves to null", async () => {
    const presented = generateApiKey().key;
    mocks.query.mockResolvedValueOnce([]);
    expect(await authenticateApiKey(presented)).toBeNull();
    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("revoked_at IS NULL");
    expect(params).toEqual([hashApiKey(presented)]);
  });
});

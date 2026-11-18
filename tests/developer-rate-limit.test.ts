import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@neondatabase/serverless", () => ({ neon: () => ({ query: mocks.query }) }));

import {
  API_KEY_RATE_LIMIT_PER_MINUTE,
  consumeApiKeyRateLimit,
  decideRateLimit,
  rateLimitWindowStart,
} from "../lib/developer/rate-limit";

const keyId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_URL = "postgres://example.test/xeccel";
});

describe("rate limit windows", () => {
  it("aligns windows to whole minutes", () => {
    expect(rateLimitWindowStart(new Date("2026-11-19T10:00:59.999Z")).toISOString()).toBe("2026-11-19T10:00:00.000Z");
    expect(rateLimitWindowStart(new Date("2026-11-19T10:01:00.000Z")).toISOString()).toBe("2026-11-19T10:01:00.000Z");
  });

  it("allows up to the limit and then blocks, reporting remaining requests and the reset time", () => {
    const now = new Date("2026-11-19T10:00:30.000Z");
    const resetAt = Math.ceil(new Date("2026-11-19T10:01:00.000Z").getTime() / 1000);
    expect(API_KEY_RATE_LIMIT_PER_MINUTE).toBe(60);
    expect(decideRateLimit(1, now)).toEqual({ allowed: true, limit: 60, remaining: 59, resetAt });
    expect(decideRateLimit(60, now)).toEqual({ allowed: true, limit: 60, remaining: 0, resetAt });
    expect(decideRateLimit(61, now)).toEqual({ allowed: false, limit: 60, remaining: 0, resetAt });
  });
});

describe("shared counter", () => {
  it("counts a request in the current window and blocks the request that passes the limit", async () => {
    mocks.query.mockResolvedValueOnce([{ hits: 61 }]);
    const decision = await consumeApiKeyRateLimit(keyId, new Date("2026-11-19T10:00:30.000Z"));
    expect(decision.allowed).toBe(false);
    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("ON CONFLICT (key_id, window_start) DO UPDATE SET hits = app_api_key_rate_windows.hits + 1");
    expect(params).toEqual([keyId, "2026-11-19T10:00:00.000Z"]);
    // Only the first request of a window prunes old counters.
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("prunes this key's old windows when a new window starts", async () => {
    mocks.query.mockResolvedValueOnce([{ hits: 1 }]).mockResolvedValueOnce([]);
    const decision = await consumeApiKeyRateLimit(keyId, new Date("2026-11-19T10:00:30.000Z"));
    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(59);
    const [pruneSql, pruneParams] = mocks.query.mock.calls[1] as [string, unknown[]];
    expect(pruneSql).toContain("DELETE FROM app_api_key_rate_windows");
    expect(pruneParams[0]).toBe(keyId);
  });
});

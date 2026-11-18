import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  list: vi.fn(), state: vi.fn(), error: vi.fn(), inspect: vi.fn(), refresh: vi.fn(),
}));

vi.mock("@/lib/meta/connections", () => ({
  listTokensToCheck: mocks.list,
  recordTokenState: mocks.state,
  recordTokenError: mocks.error,
}));
vi.mock("@/lib/meta/client", () => ({
  MetaGraphClient: class {
    constructor(public token: string) {}
    inspectToken = () => mocks.inspect(this.token);
    refreshBusinessToken = () => mocks.refresh(this.token);
  },
}));

import { refreshExpiringTokens } from "../lib/meta/token-refresh";
import { GET } from "../app/api/cron/meta-token-refresh/route";

const now = new Date("2026-12-01T00:00:00Z");
const days = (count: number) => new Date(now.getTime() + count * 86_400_000);
const candidate = (wabaId: string, accessToken = "old-token") => ({
  wabaId, workspaceId: "tenant", accessToken, expiresAt: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.state.mockResolvedValue(undefined);
  mocks.error.mockResolvedValue(undefined);
});

describe("Meta business token refresh", () => {
  it("refreshes a token that expires inside the window and stores the new one", async () => {
    mocks.list.mockResolvedValue([candidate("111111111111111")]);
    mocks.inspect.mockImplementation(async (token: string) => token === "old-token"
      ? { isValid: true, expiresAt: days(5), wabaIds: [] }
      : { isValid: true, expiresAt: days(60), wabaIds: [] });
    mocks.refresh.mockResolvedValue("new-token");

    const summary = await refreshExpiringTokens(now);

    expect(summary).toMatchObject({ checked: 1, refreshed: 1, failed: 0 });
    expect(mocks.state).toHaveBeenCalledWith({
      wabaId: "111111111111111", expiresAt: days(60), newAccessToken: "new-token",
    });
  });

  it("only records the expiry when the token is not due yet", async () => {
    mocks.list.mockResolvedValue([candidate("111111111111111")]);
    mocks.inspect.mockResolvedValue({ isValid: true, expiresAt: days(40), wabaIds: [] });

    const summary = await refreshExpiringTokens(now);

    expect(summary).toMatchObject({ notDue: 1, refreshed: 0 });
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.state).toHaveBeenCalledWith({ wabaId: "111111111111111", expiresAt: days(40) });
  });

  it("leaves a never-expiring token alone", async () => {
    mocks.list.mockResolvedValue([candidate("111111111111111")]);
    mocks.inspect.mockResolvedValue({ isValid: true, expiresAt: null, wabaIds: [] });

    expect(await refreshExpiringTokens(now)).toMatchObject({ neverExpires: 1, refreshed: 0 });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("keeps the old token, records the error and carries on when Meta refuses", async () => {
    mocks.list.mockResolvedValue([candidate("111111111111111", "a"), candidate("222222222222222", "b")]);
    mocks.inspect.mockImplementation(async (token: string) => token === "fresh"
      ? { isValid: true, expiresAt: days(60), wabaIds: [] }
      : { isValid: true, expiresAt: days(3), wabaIds: [] });
    mocks.refresh.mockImplementation(async (token: string) => {
      if (token === "a") throw new Error("Meta did not issue a new token: (#200) Permissions error");
      return "fresh";
    });

    const summary = await refreshExpiringTokens(now);

    expect(summary).toMatchObject({ checked: 2, refreshed: 1, failed: 1 });
    expect(mocks.error).toHaveBeenCalledWith("111111111111111", expect.stringMatching(/Permissions error/));
    expect(mocks.state).toHaveBeenCalledTimes(1);
    expect(mocks.state).toHaveBeenCalledWith(expect.objectContaining({ wabaId: "222222222222222", newAccessToken: "fresh" }));
  });

  it("flags a token Meta already reports as invalid instead of refreshing it", async () => {
    mocks.list.mockResolvedValue([candidate("111111111111111")]);
    mocks.inspect.mockResolvedValue({ isValid: false, expiresAt: days(-1), wabaIds: [] });

    expect(await refreshExpiringTokens(now)).toMatchObject({ failed: 1, refreshed: 0 });
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith("111111111111111", expect.stringMatching(/must reconnect/));
  });
});

describe("GET /api/cron/meta-token-refresh", () => {
  const secret = "cron-secret-for-tests-0123456789";
  const call = (authorization?: string) => GET(new NextRequest("http://localhost:3000/api/cron/meta-token-refresh", {
    headers: authorization ? { authorization } : {},
  }));

  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", secret);
    vi.stubEnv("DATABASE_URL", "postgres://test");
    vi.stubEnv("ENCRYPTION_KEY", "test-encryption-key-with-at-least-32-characters");
    mocks.list.mockResolvedValue([]);
  });

  it("fails closed when no cron secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call(`Bearer ${secret}`)).status).toBe(503);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("rejects a missing or wrong bearer token", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong-secret-of-the-same-size!!")).status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("runs the refresh for the scheduler and reports counts only", async () => {
    const res = await call(`Bearer ${secret}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { checked: 0, refreshed: 0, notDue: 0, neverExpires: 0, failed: 0 },
    });
  });
});

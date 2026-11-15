import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { workspaceAccessConfigured } from "../lib/auth/config";
import { proxy } from "../proxy";

afterEach(() => vi.unstubAllEnvs());

describe("customer access readiness", () => {
  it("does not offer a working signup form without every session dependency", () => {
    vi.stubEnv("NEON_AUTH_BASE_URL", "https://example.neonauth.test/auth");
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "cookie-secret-with-more-than-32-characters");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("AUTH_SESSION_SECRET", "");
    expect(workspaceAccessConfigured()).toBe(false);
    vi.stubEnv("DATABASE_URL", "postgresql://test-only");
    vi.stubEnv("AUTH_SESSION_SECRET", "short");
    expect(workspaceAccessConfigured()).toBe(false);
    vi.stubEnv("AUTH_SESSION_SECRET", "session-secret-with-more-than-32-characters");
    expect(workspaceAccessConfigured()).toBe(true);
  });

  it("opens the setup guide while preserving workspace and API authentication", async () => {
    const guide = await proxy(new NextRequest("https://xeccel.com/getting-started"));
    expect(guide.status).toBe(200);
    for (const path of ["/dashboard", "/settings/team", "/settings/waba", "/inbox"]) {
      const response = await proxy(new NextRequest(`https://xeccel.com${path}`));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
    }
    const response = await proxy(new NextRequest("https://xeccel.com/api/workspaces/team"));
    expect(response.status).toBe(401);
  });
});

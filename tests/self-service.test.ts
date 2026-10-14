import { afterEach, describe, expect, it, vi } from "vitest";
import { neonAuthConfigured } from "../lib/auth/config";
import { createWorkspaceSlug } from "../lib/workspaces/store";

afterEach(() => vi.unstubAllEnvs());

describe("self-service identity configuration", () => {
  it("fails closed when Managed Auth is not configured", async () => {
    vi.stubEnv("NEON_AUTH_BASE_URL", "");
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "");
    expect(neonAuthConfigured()).toBe(false);
  });

  it("requires a sufficiently long cookie secret", () => {
    vi.stubEnv("NEON_AUTH_BASE_URL", "https://example.neonauth.test/auth");
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "too-short");
    expect(neonAuthConfigured()).toBe(false);

    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "a-secure-cookie-secret-with-32-characters");
    expect(neonAuthConfigured()).toBe(true);
  });

  it("creates deterministic tenant slugs without exposing raw user IDs", () => {
    expect(createWorkspaceSlug("Acme Advisors Pvt. Ltd.", "auth_user_1234567890")).toBe(
      "acme-advisors-pvt-ltd-34567890"
    );
  });
});

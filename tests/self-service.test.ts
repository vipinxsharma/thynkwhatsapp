import { afterEach, describe, expect, it, vi } from "vitest";
import { neonAuthConfigured } from "../lib/auth/config";
import { createWorkspaceSlug } from "../lib/workspaces/store";
import { validMetaIdentifier } from "../lib/meta/connections";
import { extractWorkspaceSlug } from "../lib/support/store";
import { applyResolutionGate, redactSensitiveText } from "../lib/support/ai";

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

  it("accepts only numeric Meta account identifiers", () => {
    expect(validMetaIdentifier("109823485723910")).toBe(true);
    expect(validMetaIdentifier("1234")).toBe(false);
    expect(validMetaIdentifier("109823485723910?fields=token")).toBe(false);
  });

  it("routes signed support email only from a workspace-specific address", () => {
    expect(extractWorkspaceSlug("support+acme-advisors@example.com")).toBe("acme-advisors");
    expect(extractWorkspaceSlug("Support+ACME-ADVISORS@example.com")).toBe("acme-advisors");
    expect(extractWorkspaceSlug("support@example.com")).toBeNull();
    expect(extractWorkspaceSlug("support+../admin@example.com")).toBeNull();
  });

  it("redacts secrets and personal identifiers before AI processing", () => {
    const redacted = redactSensitiveText(
      "Bearer abc.def.ghi email owner@example.com phone +91 97630 08800 token-abcdefghijklmnop"
    );
    expect(redacted).not.toContain("owner@example.com");
    expect(redacted).not.toContain("97630");
    expect(redacted).not.toContain("abcdefghijklmnop");
  });

  it("auto-resolves only safe, high-confidence answers grounded in approved evidence", () => {
    const grounded = applyResolutionGate(
      { category: "product_guidance", outcome: "answer", confidence: 0.95, answer: "Use the verified callback URL.", evidence: ["kb-1"] },
      new Set(["kb-1"])
    );
    expect(grounded.status).toBe("auto_resolved");

    const ungrounded = applyResolutionGate(
      { category: "product_guidance", outcome: "answer", confidence: 0.99, answer: "Done.", evidence: ["invented"] },
      new Set(["kb-1"])
    );
    expect(ungrounded.status).toBe("escalated");
  });

  it("always escalates account restrictions even at high model confidence", () => {
    const result = applyResolutionGate(
      { category: "account_restriction", outcome: "answer", confidence: 1, answer: "Contact Meta support.", evidence: ["meta-account-boundaries"] },
      new Set(["meta-account-boundaries"])
    );
    expect(result.status).toBe("escalated");
    expect(result.resolution.answer).toContain("human review");
  });
});

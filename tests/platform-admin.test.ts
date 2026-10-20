import { describe, expect, it } from "vitest";
import { isPlatformAdminIdentity } from "../lib/auth/platform-admin-policy";

describe("platform superadmin identity allowlist", () => {
  const user = { id: "auth-user-1", email: "Partner@Thynkwise.co.in", emailVerified: true };

  it("matches verified email addresses case-insensitively", () => {
    expect(isPlatformAdminIdentity(user, "partner@thynkwise.co.in")).toBe(true);
  });

  it("supports a comma-separated allowlist", () => {
    expect(isPlatformAdminIdentity(user, "ops@example.com, partner@thynkwise.co.in")).toBe(true);
  });

  it("rejects unverified identities and email-only claims", () => {
    expect(isPlatformAdminIdentity({ ...user, emailVerified: false }, user.email)).toBe(false);
    expect(isPlatformAdminIdentity({ ...user, id: "" }, user.email)).toBe(false);
  });

  it("does not grant access to an address outside the allowlist", () => {
    expect(isPlatformAdminIdentity(user, "vipin@thynkwise.co.in")).toBe(false);
    expect(isPlatformAdminIdentity(user, "")).toBe(false);
  });
});

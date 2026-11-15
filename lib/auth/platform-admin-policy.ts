export interface PlatformAdminIdentity {
  id: string;
  email: string;
  emailVerified: boolean;
}

export function isPlatformAdminIdentity(
  identity: PlatformAdminIdentity | null | undefined,
  allowedEmails = process.env.PLATFORM_SUPERADMIN_EMAILS
): boolean {
  if (!identity?.id || !identity.email || identity.emailVerified !== true) return false;
  const email = identity.email.trim().toLowerCase();
  const allowlist = (allowedEmails || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email);
}

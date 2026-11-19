// Pure helpers for platform-admin tenant owner invitations (no database access).

export interface TenantInviteInput {
  email: string;
  workspaceName: string;
}

export function parseTenantInviteInput(payload: unknown): TenantInviteInput | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const email = String(record.email ?? "").trim().toLowerCase();
  const workspaceName = String(record.workspaceName ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return null;
  if (workspaceName.length < 1 || workspaceName.length > 120) return null;
  return { email, workspaceName };
}

export function buildTenantInviteUrl(origin: string, token: string): string {
  return `${origin}/invite#token=${encodeURIComponent(token)}`;
}

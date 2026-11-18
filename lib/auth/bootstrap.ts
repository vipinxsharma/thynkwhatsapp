import { cookies } from "next/headers";
import { neonAuth } from "@/lib/auth/neon";
import { neonAuthConfigured } from "@/lib/auth/config";
import { createSessionToken, SESSION_COOKIE_NAME, type AppSession } from "@/lib/auth/token";
import { ensureWorkspaceForUser } from "@/lib/workspaces/store";

export type AuthenticatedIdentity = { id: string; email: string; name?: string | null };

/**
 * Pass the user returned by the sign-in / sign-up call that ran in this same
 * request. neonAuth.getSession() reads cookies from the incoming request
 * headers, so it cannot see a session cookie that was only just set on the
 * response: from a signed-out browser it returns no user.
 */
export async function issueApplicationSession(authenticated?: AuthenticatedIdentity | null): Promise<AppSession> {
  if (!neonAuthConfigured()) throw new Error("Neon Auth is not configured");

  const user = authenticated ?? (await neonAuth.getSession()).data?.user;
  if (!user?.id || !user.email) throw new Error("Authentication required");

  const membership = await ensureWorkspaceForUser({
    id: user.id,
    email: user.email,
    name: user.name || user.email.split("@")[0],
  });
  const session: AppSession = {
    userId: user.id,
    email: user.email,
    tenantId: membership.workspaceId,
    tenantName: membership.workspaceName,
    role: membership.role,
  };
  const token = await createSessionToken(session, "30m");
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 60,
  });
  return session;
}

export async function clearApplicationSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

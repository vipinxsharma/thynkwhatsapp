import { cookies } from "next/headers";
import { neonAuth } from "@/lib/auth/neon";
import { neonAuthConfigured } from "@/lib/auth/config";
import { createSessionToken, SESSION_COOKIE_NAME, type AppSession } from "@/lib/auth/token";
import { ensureWorkspaceForUser } from "@/lib/workspaces/store";

export async function issueApplicationSession(): Promise<AppSession> {
  if (!neonAuthConfigured()) throw new Error("Neon Auth is not configured");

  const { data } = await neonAuth.getSession();
  const user = data?.user;
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

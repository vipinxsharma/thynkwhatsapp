import { redirect } from "next/navigation";
import { neonAuth } from "@/lib/auth/neon";
import type { AppSession } from "@/lib/auth/token";
import { isPlatformAdminIdentity } from "@/lib/auth/platform-admin-policy";

export async function isPlatformSuperadmin(session: AppSession): Promise<boolean> {
  const { data } = await neonAuth.getSession();
  const user = data?.user;
  return Boolean(
    user &&
      user.id === session.userId &&
      user.email?.trim().toLowerCase() === session.email.trim().toLowerCase() &&
      isPlatformAdminIdentity({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      })
  );
}

export async function requirePlatformSuperadmin(session: AppSession): Promise<void> {
  if (!(await isPlatformSuperadmin(session))) redirect("/dashboard");
}

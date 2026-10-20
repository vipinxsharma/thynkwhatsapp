import { DashboardShell } from "@/components/layout/DashboardShell";
import { requirePageSession } from "@/lib/auth/session";
import { isPlatformSuperadmin } from "@/lib/auth/platform-admin";
import { listWorkspaceMemberships } from "@/lib/workspaces/store";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();
  const memberships = await listWorkspaceMemberships(session.userId);
  const platformSuperadmin = await isPlatformSuperadmin(session);
  return <DashboardShell session={session} memberships={memberships} platformSuperadmin={platformSuperadmin}>{children}</DashboardShell>;
}

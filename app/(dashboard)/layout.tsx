import { DashboardShell } from "@/components/layout/DashboardShell";
import { requirePageSession } from "@/lib/auth/session";
import { listWorkspaceMemberships } from "@/lib/workspaces/store";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();
  const memberships = await listWorkspaceMemberships(session.userId);
  return <DashboardShell session={session} memberships={memberships}>{children}</DashboardShell>;
}

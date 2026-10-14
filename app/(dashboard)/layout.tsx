import { DashboardShell } from "@/components/layout/DashboardShell";
import { requirePageSession } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();
  return <DashboardShell session={session}>{children}</DashboardShell>;
}

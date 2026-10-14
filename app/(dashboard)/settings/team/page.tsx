import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/auth/session";
import { listWorkspaceTeam } from "@/lib/workspaces/team";
import { TeamSettings } from "@/components/team/TeamSettings";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const session = await requirePageSession();
  if (!['owner', 'admin'].includes(session.role)) redirect("/dashboard");
  const team = await listWorkspaceTeam(session.tenantId);
  return (
    <main className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-white">Team</h1>
        <p className="mb-6 mt-2 text-sm text-gray-400">Invite teammates and review access to this workspace.</p>
        <TeamSettings initialMembers={team.members} initialInvitations={team.invitations} currentRole={session.role} />
      </div>
    </main>
  );
}

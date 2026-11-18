import { StrapiClient } from "@/lib/strapi/client";
import { UnifiedInbox } from "@/components/inbox/UnifiedInbox";
import { requirePageSession } from "@/lib/auth/session";
import { listWorkspaceTeam } from "@/lib/workspaces/team";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const session = await requirePageSession();
  const strapi = new StrapiClient(session.tenantId);

  // Pre-fetch conversations and templates on the server
  const conversations = await strapi.getConversations();
  const templates = await strapi.getTemplates();
  // Only the fields needed for an assignee picker; no emails leave the server.
  const { members } = await listWorkspaceTeam(session.tenantId);
  const assignees = members
    .filter((member) => member.status === "active")
    .map((member) => ({ authUserId: member.authUserId, label: member.displayName || member.email }));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <UnifiedInbox
        initialConversations={conversations}
        initialMessages={{}}
        templates={templates}
        currentUserId={session.userId}
        currentRole={session.role}
        assignees={assignees}
      />
    </div>
  );
}

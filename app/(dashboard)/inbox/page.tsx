import { StrapiClient } from "@/lib/strapi/client";
import { UnifiedInbox } from "@/components/inbox/UnifiedInbox";
import { requirePageSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const session = await requirePageSession();
  const strapi = new StrapiClient(session.tenantId);

  // Pre-fetch conversations and templates on the server
  const conversations = await strapi.getConversations();
  const templates = await strapi.getTemplates();

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <UnifiedInbox
        initialConversations={conversations}
        initialMessages={{}}
        templates={templates}
      />
    </div>
  );
}

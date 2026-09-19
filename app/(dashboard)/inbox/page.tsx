import { StrapiClient } from "@/lib/strapi/client";
import { UnifiedInbox } from "@/components/inbox/UnifiedInbox";
import { Message } from "@/types/strapi";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const strapi = new StrapiClient();

  // Pre-fetch conversations and templates on the server
  const conversations = await strapi.getConversations();
  const templates = await strapi.getTemplates();

  // Load message threads for each conversation
  const messagesMap: Record<string, Message[]> = {};
  for (const conv of conversations) {
    messagesMap[String(conv.id)] = await strapi.getMessages(conv.id);
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <UnifiedInbox
        initialConversations={conversations}
        initialMessages={messagesMap}
        templates={templates}
      />
    </div>
  );
}

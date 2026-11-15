import { isDurableInboxEnabled } from "@/lib/strapi/client";
import { requirePageSession } from "@/lib/auth/session";
import { listWhatsAppChannels } from "@/lib/meta/connections";
import { ChannelManager } from "@/components/meta/ChannelManager";

export const dynamic = "force-dynamic";

export default async function WabaSettingsPage() {
  const session = await requirePageSession();
  const durable = isDurableInboxEnabled();
  const channels = durable ? await listWhatsAppChannels(session.tenantId) : [];
  return <ChannelManager initialChannels={channels} durable={durable}
    canManage={session.role === "owner" || session.role === "admin"} />;
}

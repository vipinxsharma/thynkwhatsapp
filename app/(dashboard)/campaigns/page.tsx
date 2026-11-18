import { requirePageSession } from "@/lib/auth/session";
import { listWhatsAppChannels } from "@/lib/meta/connections";
import { CampaignsScreen } from "@/components/campaigns/CampaignsScreen";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const session = await requirePageSession();
  const channels = await listWhatsAppChannels(session.tenantId).catch(() => []);

  return (
    <CampaignsScreen
      role={session.role}
      channels={channels.map((channel) => ({
        phoneNumberId: channel.phoneNumberId,
        displayPhoneNumber: channel.displayPhoneNumber ?? "",
        verifiedName: channel.verifiedName ?? "",
        channelName: channel.channelName ?? null,
        enabled: channel.enabled,
        isDefault: channel.isDefault,
      }))}
    />
  );
}

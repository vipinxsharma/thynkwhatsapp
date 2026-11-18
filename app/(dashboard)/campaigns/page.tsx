import { requirePageSession } from "@/lib/auth/session";
import { listWhatsAppChannels } from "@/lib/meta/connections";
import { StrapiClient } from "@/lib/strapi/client";
import { selectableTemplates } from "@/components/campaigns/campaign-helpers";
import { CampaignsScreen } from "@/components/campaigns/CampaignsScreen";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const session = await requirePageSession();

  // Channels come from the connected-number store; templates from the synced template cache.
  // The campaign API re-checks the template with Meta when a draft is created.
  const [channels, templates] = await Promise.all([
    listWhatsAppChannels(session.tenantId).catch(() => []),
    new StrapiClient(session.tenantId).getTemplates().catch(() => []),
  ]);

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
      templates={selectableTemplates(templates)}
    />
  );
}

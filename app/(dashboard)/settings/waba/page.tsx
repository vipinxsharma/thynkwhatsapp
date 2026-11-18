import { isDurableInboxEnabled } from "@/lib/strapi/client";
import { requirePageSession } from "@/lib/auth/session";
import { listWhatsAppChannels } from "@/lib/meta/connections";
import { ChannelManager } from "@/components/meta/ChannelManager";

export const dynamic = "force-dynamic";

export default async function WabaSettingsPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const session = await requirePageSession();
  const { payment } = await searchParams;
  const durable = isDurableInboxEnabled();
  const channels = durable ? await listWhatsAppChannels(session.tenantId) : [];
  const canManage = session.role === "owner" || session.role === "admin";
  const paymentReceived = payment === "success";
  return (
    <div className={paymentReceived ? "rounded-2xl ring-2 ring-whatsapp" : undefined}>
      {paymentReceived && (
        <div role="status" className="mx-8 mt-8 rounded-xl border border-whatsapp bg-whatsapp/10 p-4 text-sm">
          <p className="font-semibold">Payment received. Connect your WhatsApp number to start messaging.</p>
          <p className="mt-1 text-[var(--muted)]">Use Connect channel below. Your number is connected through Meta&apos;s checks.</p>
        </div>
      )}
      <ChannelManager initialChannels={channels} durable={durable} canManage={canManage} />
    </div>
  );
}

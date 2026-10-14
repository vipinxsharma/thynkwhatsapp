import Link from "next/link";
import { requirePageSession } from "@/lib/auth/session";
import { getMessageUsage, parseUsageRange } from "@/lib/analytics/message-usage";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await requirePageSession();
  const range = parseUsageRange((await searchParams).range);
  let usage: Awaited<ReturnType<typeof getMessageUsage>> | null = null;
  let unavailable = false;
  try {
    usage = await getMessageUsage(session.tenantId, range);
  } catch (error) {
    console.error("Message usage could not be loaded", error);
    unavailable = true;
  }

  const metrics = usage
    ? [
        ["Total messages", usage.total],
        ["Inbound", usage.inbound],
        ["Outbound", usage.outbound],
        ["Delivered outbound", usage.delivered],
        ["Read outbound", usage.read],
        ["Failed outbound", usage.failed],
      ] as const
    : [];

  return (
    <main className="flex-1 overflow-y-auto p-8 max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 border-b border-white/5 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Messaging analytics</h1>
          <p className="mt-1 text-sm text-gray-400">
            Recorded messages for {session.tenantName}. Times are based on the message timestamp in UTC.
          </p>
        </div>
        <nav aria-label="Reporting period" className="flex gap-2">
          {(["7d", "30d", "90d"] as const).map((option) => (
            <Link
              key={option}
              href={`/analytics?range=${option}`}
              aria-current={range === option ? "page" : undefined}
              className={`rounded-lg border px-3 py-2 text-sm ${
                range === option
                  ? "border-whatsapp/30 bg-whatsapp/20 text-whatsapp-light"
                  : "border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              Last {option}
            </Link>
          ))}
        </nav>
      </div>

      {unavailable ? (
        <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200">
          Messaging data is unavailable. No usage or delivery results can be reported until durable inbox storage is connected.
        </div>
      ) : usage ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/5 bg-surface-100/60 p-5">
                <p className="text-sm text-gray-400">{label}</p>
                <p className="mt-2 text-3xl font-bold text-white">{value.toLocaleString()}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-400">
            {usage.total === 0
              ? "No messages have been recorded in this period."
              : `Latest recorded message: ${new Date(usage.lastMessageAt!).toLocaleString("en-GB", { timeZone: "UTC" })} UTC.`}
          </p>
          <p className="text-xs text-gray-500">
            Source: this workspace&apos;s durable inbox. Delivery and read counts reflect recorded outbound status updates; missing provider callbacks are not counted as delivery.
          </p>
        </>
      ) : null}

      <section className="rounded-2xl border border-white/5 bg-surface-100/60 p-5">
        <h2 className="text-lg font-semibold text-white">Billing and Meta costs</h2>
        <p className="mt-2 text-sm text-gray-400">
          Not connected. Actual charges, currency, and pricing category are unavailable, so no cost estimate is shown.
        </p>
      </section>
    </main>
  );
}

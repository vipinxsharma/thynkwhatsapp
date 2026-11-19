import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/auth/session";
import { reconcileRevenue, type RevenueReport } from "@/lib/revenue/reconcile";
import { loadRevenueInputs } from "@/lib/revenue/store";

export const dynamic = "force-dynamic";

function rupees(paise: number): string {
  return (paise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
}

function sourceLabel(row: { sourceType: "ad" | "post"; sourceId: string; headline: string }): string {
  const kind = row.sourceType === "ad" ? "Ad" : "Post";
  return row.headline ? `${kind}: ${row.headline}` : `${kind} ${row.sourceId}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--heading)]">{value}</p>
    </div>
  );
}

function Report({ report }: { report: RevenueReport }) {
  const { totals, unattributed, sources, spend } = report;
  return (
    <div className="space-y-6">
      <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-[var(--foreground)]">
        {spend.status === "synced"
          ? "Ad spend is synced. ROAS is shown only for sources with spend above zero."
          : "Ad spend is not synced for this workspace, so spend and ROAS are not shown. Revenue below counts verified payments only."}
      </p>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Verified revenue" value={rupees(totals.verifiedRevenuePaise)} />
        <Stat label="Verified orders" value={String(totals.verifiedOrders)} />
        <Stat label="Attributed conversations" value={String(totals.attributedConversations)} />
        <Stat label="Open orders" value={String(totals.openOrders)} />
      </div>

      <section className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Conversations</th>
              <th className="px-4 py-3 font-medium">Orders</th>
              <th className="px-4 py-3 font-medium">Verified revenue</th>
              <th className="px-4 py-3 font-medium">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {sources.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--muted)]">
                  No click-to-WhatsApp referrals yet.
                </td>
              </tr>
            )}
            {sources.map((row) => (
              <tr key={row.sourceKey} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 text-[var(--foreground)]">{sourceLabel(row)}</td>
                <td className="px-4 py-3">{row.attributedConversations}</td>
                <td className="px-4 py-3">{row.orders}</td>
                <td className="px-4 py-3">{rupees(row.verifiedRevenuePaise)}</td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {row.roas === null ? "Not available" : `${row.roas.toFixed(2)}x`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2 text-sm text-[var(--muted)]">
        <p>
          Unattributed verified revenue: {rupees(unattributed.verifiedRevenuePaise)} from {unattributed.verifiedOrders} orders created
          before any referral.
        </p>
        <p>
          Paid but not verified: {totals.unverifiedPaidOrders} orders. Verified payments that disagree with their order:{" "}
          {totals.mismatchedOrders}. Unverified payment events ignored: {totals.unverifiedPaymentEvents}.
        </p>
      </section>
    </div>
  );
}

export default async function GrowthRevenuePage() {
  const session = await requirePageSession();
  if (!["owner", "admin"].includes(session.role)) redirect("/growth");

  let report: RevenueReport | null = null;
  try {
    report = reconcileRevenue(await loadRevenueInputs(session.tenantId));
  } catch {
    report = null;
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-7">
        <header className="space-y-3 border-b border-[var(--border)] pb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-whatsapp-dark">Revenue reporting</p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--heading)]">Attributed revenue</h1>
          <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Click-to-WhatsApp referrals joined to checkout orders. Revenue counts only orders with a verified payment.
          </p>
        </header>
        {report ? (
          <Report report={report} />
        ) : (
          <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-[var(--foreground)]">
            The revenue report is unavailable right now. Try again later.
          </p>
        )}
      </div>
    </main>
  );
}

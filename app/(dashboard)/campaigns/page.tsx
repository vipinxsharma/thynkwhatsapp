import Link from "next/link";

export default function CampaignsPage() {
  return (
    <main className="flex-1 overflow-y-auto p-8 max-w-4xl space-y-6">
      <div className="border-b border-white/5 pb-6">
        <h1 className="text-2xl font-bold text-white">Campaigns</h1>
        <p className="mt-1 text-sm text-gray-400">Broadcast sending is not yet available for customer workspaces.</p>
      </div>
      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
        <h2 className="text-lg font-semibold text-amber-100">Launch is disabled</h2>
        <p className="mt-2 text-sm text-amber-100/80">
          The previous screen contained sample templates, sample audience counts, and a pricing estimate.
          Those were not your account&apos;s results. Campaigns will become available after approved-template
          selection, consent checks, durable scheduling, delivery tracking, and billing are connected and tested.
        </p>
      </section>
      <div className="flex flex-wrap gap-3">
        <Link href="/templates" className="rounded-lg bg-whatsapp px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          Review templates
        </Link>
        <Link href="/analytics" className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-200 hover:border-white/30">
          View recorded usage
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";

export default function CampaignsPage() {
  return (
    <main className="flex-1 overflow-y-auto p-8 max-w-4xl space-y-6">
      <div className="border-b border-white/5 pb-6">
        <h1 className="text-2xl font-bold text-white">Campaigns</h1>
        <p className="mt-1 text-sm text-gray-400">Prepare your audience and approved message templates.</p>
      </div>
      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
        <h2 className="text-lg font-semibold text-amber-100">Campaign delivery requirements</h2>
        <p className="mt-2 text-sm text-amber-100/80">
          Bulk campaign delivery is unavailable. You can prepare contacts and review templates now.
          Contact the Xeccel team to discuss your requirements and availability before planning a broadcast.
        </p>
      </section>
      <div className="flex flex-wrap gap-3">
        <a href="mailto:partner@thynkwise.co.in?subject=Xeccel%20campaign%20requirements" className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-200">Discuss campaign requirements</a>
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

export default function AutomationsPage() {
  return (
    <main className="flex-1 overflow-y-auto p-8 max-w-4xl space-y-6">
      <div className="border-b border-white/5 pb-6">
        <h1 className="text-2xl font-bold text-white">Automations</h1>
        <p className="mt-1 text-sm text-gray-400">AI and rules-based workflows are under development.</p>
      </div>
      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
        <h2 className="text-lg font-semibold text-amber-100">Customer automations are not active</h2>
        <p className="mt-2 text-sm text-amber-100/80">
          The earlier rules and trigger counts were examples held in one server process. They were not saved
          to your workspace, and receiving a message did not run them. Automated replies will remain disabled
          until rules are durable, tenant-scoped, opt-in, tested against real webhooks, and auditable.
        </p>
      </section>
    </main>
  );
}

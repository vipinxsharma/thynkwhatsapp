export default function AutomationsPage() {
  return (
    <main className="flex-1 overflow-y-auto p-8 max-w-4xl space-y-6">
      <div className="border-b border-white/5 pb-6">
        <h1 className="text-2xl font-bold text-white">Automations</h1>
        <p className="mt-1 text-sm text-gray-400">Explore the workflows you can prepare for your service team.</p>
      </div>
      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
        <h2 className="text-lg font-semibold text-amber-100">Customer automations are not active</h2>
        <p className="mt-2 text-sm text-amber-100/80">
          Automated customer replies are unavailable. Before activation, rules need saved workspace settings,
          consent checks, verified channel events, and an activity history. Use the inbox for replies and
          contact our team to discuss routing, keyword responses, sequences, and chatbot requirements.
        </p>
        <a href="mailto:partner@thynkwise.co.in?subject=Xeccel%20automation%20requirements" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent-text)] underline">Discuss automation requirements →</a>
      </section>
    </main>
  );
}

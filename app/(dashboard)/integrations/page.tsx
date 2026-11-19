import Link from "next/link";
import { requirePageSession } from "@/lib/auth/session";
import { ApiKeysPanel } from "@/components/developer/ApiKeysPanel";
import { WebhooksPanel } from "@/components/developer/WebhooksPanel";

const REFERENCE_SNIPPET = `curl https://YOUR-XECCEL-DOMAIN/api/v1/messages \\
  -H "Authorization: Bearer $XECCEL_API_KEY" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "+919876543210", "type": "text", "text": "Your order has shipped."}'`;

const ENDPOINTS: Array<{ method: string; path: string; note: string }> = [
  { method: "POST", path: "/api/v1/messages", note: "Send text inside the 24-hour window, or an approved template at any time." },
  { method: "GET", path: "/api/v1/contacts", note: "List contacts, oldest first, with cursor paging." },
  { method: "POST", path: "/api/v1/contacts", note: "Create or update a contact by phone number." },
  { method: "GET", path: "/api/v1/templates", note: "List the WABA's message templates, with their approval status." },
];

export default async function IntegrationsPage() {
  const session = await requirePageSession();
  const canManage = session.role === "owner" || session.role === "admin";

  return (
    <main className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-3 border-b border-[var(--border)] pb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-whatsapp-dark">Connect Xeccel</p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--heading)]">Integrations &amp; developer tools</h1>
          <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Create API keys for your own systems, and receive workspace events at a URL you control.
            Keys and webhooks belong to this workspace only.
          </p>
        </header>

        <section className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--heading)]">Developer API keys</h2>
            <p className="text-sm leading-6 text-[var(--muted)]">
              A key authenticates requests with <code>Authorization: Bearer</code>. Keys are shown once, stored only as hashes,
              and limited to 60 requests per minute each. Every create and revoke is written to the audit log.
            </p>
          </div>
          <ApiKeysPanel canManage={canManage} />

          <div className="space-y-3 border-t border-[var(--border)] pt-5">
            <h3 className="text-sm font-semibold text-[var(--heading)]">Reference</h3>
            <ul className="space-y-2 text-sm text-[var(--muted)]">
              {ENDPOINTS.map((endpoint) => (
                <li key={`${endpoint.method} ${endpoint.path}`}>
                  <span className="font-mono text-xs font-semibold text-[var(--foreground)]">{endpoint.method} {endpoint.path}</span>
                  <span className="block">{endpoint.note}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Errors are JSON in the form <code>{"{ \"error\": { \"code\", \"message\" } }"}</code>. Sending requires an <code>Idempotency-Key</code>
              UUID header, so a retry never sends a message twice.
            </p>
            <pre className="overflow-x-auto rounded-xl bg-[var(--surface-muted)] p-4 text-xs leading-5 text-[var(--foreground)]">
              <code>{REFERENCE_SNIPPET}</code>
            </pre>
          </div>
        </section>

        <section className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--heading)]">Outbound webhooks</h2>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Each workspace has one endpoint. Each POST is signed with <code>X-Xeccel-Signature</code>
              (<code>t=&lt;unix seconds&gt;,v1=&lt;HMAC-SHA256 of &quot;t.body&quot;&gt;</code>). Failed deliveries are retried with backoff
              for up to six attempts. Only https URLs are accepted.
            </p>
          </div>
          <WebhooksPanel canManage={canManage} />
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-[var(--heading)]">WhatsApp channel</h2>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
                Available foundation
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Connect a WABA and inspect the ownership record and stored subscription status. Live delivery still needs Meta acceptance and webhook proof.
            </p>
            <Link href="/settings/waba" className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-whatsapp-dark hover:underline">
              Open channel settings →
            </Link>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-[var(--heading)]">CRM and commerce connectors</h2>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
                Planned
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Planned: explicit, opt-in integrations with field mapping and sync health rather than copying contact data automatically.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

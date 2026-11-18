import Link from "next/link";
import type { PartnerConnectionRow, PartnerStatus } from "@/lib/partner-solutions/status";

export type PartnerConnectionView = Omit<PartnerConnectionRow, "status"> & { status: PartnerStatus };

const toneClass: Record<PartnerStatus["tone"], string> = {
  ok: "border-[var(--accent)] text-[var(--accent-text)]",
  warn: "border-[var(--border)] text-[var(--heading)]",
  action: "border-red-400/40 text-red-300",
};

export function PartnerSolutionsView({
  connections,
  summary,
  canManage,
  unavailable,
}: {
  connections: PartnerConnectionView[];
  summary: { total: number; needsAction: number; connected: number };
  canManage: boolean;
  unavailable: boolean;
}) {
  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent-text)]">Partner solutions</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--heading)]">How your WhatsApp numbers are connected</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
        Xeccel connects your WhatsApp Business numbers through its Meta Tech Provider partnership. This page shows the
        status of each connection and what, if anything, you need to do next.
      </p>

      {unavailable && (
        <p role="alert" className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          Your connection status could not be loaded just now. Please refresh the page.
        </p>
      )}

      <section aria-label="Summary" className="mt-8 grid gap-4 sm:grid-cols-3">
        <SummaryTile label="Numbers" value={summary.total} />
        <SummaryTile label="Connected" value={summary.connected} />
        <SummaryTile label="Need attention" value={summary.needsAction} />
      </section>

      <section aria-labelledby="connections-heading" className="mt-10">
        <h2 id="connections-heading" className="text-lg font-bold text-[var(--heading)]">Connections</h2>
        {connections.length === 0 && !unavailable ? (
          <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
            No WhatsApp number is connected yet. <Link className="font-bold text-[var(--accent-text)]" href="/settings/waba">Connect a channel</Link> to get started.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {connections.map((connection) => (
              <li key={connection.phoneNumberId} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-[var(--heading)]">{connection.verifiedName || "WhatsApp number"}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{connection.displayPhoneNumber || "Number pending display"}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${toneClass[connection.status.tone]}`}>
                    {connection.status.label}
                  </span>
                </div>
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                  <Detail label="Connected through" value="Xeccel (Meta Tech Provider)" />
                  <Detail label="Incoming messages" value={connection.webhookSubscribed ? "Active" : "Not set up"} />
                  <Detail label="Access renews" value={formatExpiry(connection.tokenExpiresAt)} />
                </dl>
                {connection.status.nextStep && (
                  <p className="mt-5 rounded-xl bg-[var(--background)] p-4 text-sm leading-6 text-[var(--heading)]">
                    <span className="font-bold">Next step: </span>
                    {connection.status.nextStep}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="access-heading" className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 id="access-heading" className="text-lg font-bold text-[var(--heading)]">Who can manage connections</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {canManage
            ? "As a workspace owner or admin, you can connect, reconnect and rename numbers from Channels."
            : "Only a workspace owner or admin can connect or reconnect numbers. Ask one of them to make changes."}
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Changes to partner permissions are made in Meta Business Manager and are not editable here. Contact Xeccel support if you need them changed.
        </p>
      </section>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--heading)]">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 text-[var(--heading)]">{value}</dd>
    </div>
  );
}

function formatExpiry(value: string | null): string {
  if (!value) return "Does not expire";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

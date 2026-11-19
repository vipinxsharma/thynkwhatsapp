import Link from "next/link";
import { requirePageSession } from "@/lib/auth/session";
import { getAdsConnection, type AdsConnectionStatus } from "@/lib/ads/connection-store";
import { AdsDisconnectButton } from "@/components/growth/AdsDisconnectButton";

const statusMessages: Record<string, string> = {
  connected: "Ad account connected with read-only access.",
  denied: "Connection cancelled on Meta. Nothing was connected.",
  invalid_state: "This connection link expired or did not match this session. Start again.",
  not_granted: "Meta did not grant read-only access (ads_read), so nothing was connected. Start again and approve it.",
  failed: "The connection could not be completed. Try again in a moment.",
  unavailable: "Ad account connection is not configured on this server yet.",
};

export default async function AdsConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requirePageSession();
  const { status } = await searchParams;
  const canManage = session.role === "owner" || session.role === "admin";
  const connection: AdsConnectionStatus | null = process.env.DATABASE_URL
    ? await getAdsConnection(session.tenantId).catch(() => null)
    : null;
  const isConnected = connection?.status === "connected";

  return (
    <main className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="mx-auto max-w-3xl space-y-7">
        <header className="space-y-3 border-b border-[var(--border)] pb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-whatsapp-dark">Growth channels</p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--heading)]">Connect an ad account</h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Connecting is optional and read-only. It lets Thynk show which click-to-WhatsApp ad a conversation came from.
          </p>
          <Link href="/growth" className="inline-flex min-h-10 items-center text-sm font-semibold text-whatsapp-dark hover:underline">
            ← Back to growth channels
          </Link>
        </header>

        {status && statusMessages[status] && (
          <p role="status" className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--foreground)]">
            {statusMessages[status]}
          </p>
        )}

        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold text-[var(--heading)]">What this connection does</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--muted)]">
            <li>Requests one permission from Meta: <strong className="text-[var(--foreground)]">ads_read</strong>, read-only.</li>
            <li>Stores the names and IDs of the ad accounts you can access, and an encrypted access token.</li>
            <li>Uses the link from an inbound WhatsApp message to record the ad or post it came from.</li>
          </ul>
          <h2 className="pt-2 text-lg font-semibold text-[var(--heading)]">What it never does</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--muted)]">
            <li>It does not create, edit, pause or delete ads, and it does not change budgets or delivery.</li>
            <li>It does not request ads_management or any other ads write permission.</li>
            <li>It does not connect anything until you approve it on Meta's own screen.</li>
          </ul>
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-[var(--foreground)]">
            Meta reviews the ads_read permission before it works for every user. Until the Thynk app is approved for it,
            the connection works only for people with a role on the Meta app.
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[var(--heading)]">Status</h2>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
              {isConnected ? "Connected (read-only)" : "Not connected"}
            </span>
          </div>

          {isConnected && connection && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--muted)]">
                Connected {connection.connectedAt ? `on ${connection.connectedAt.slice(0, 10)}` : ""}. {connection.adAccounts.length} ad account(s) on the first page of results.
              </p>
              {connection.adAccounts.length > 0 && (
                <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] text-sm">
                  {connection.adAccounts.map((account) => (
                    <li key={account.id} className="flex flex-wrap justify-between gap-2 p-3">
                      <span className="text-[var(--foreground)]">{account.name || "Unnamed account"}</span>
                      <span className="font-mono text-xs text-[var(--muted)]">act_{account.id.replace(/^act_/, "")}</span>
                    </li>
                  ))}
                </ul>
              )}
              {canManage && <AdsDisconnectButton />}
            </div>
          )}

          {!isConnected && canManage && (
            <a
              href="/api/meta/ads/authorize"
              className="inline-flex min-h-11 items-center rounded-lg bg-whatsapp-dark px-5 text-sm font-semibold text-white hover:opacity-90"
            >
              Continue to Meta to approve read-only access
            </a>
          )}
          {!isConnected && !canManage && (
            <p className="text-sm text-[var(--muted)]">Only a workspace owner or admin can connect an ad account.</p>
          )}
        </section>
      </div>
    </main>
  );
}

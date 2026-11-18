"use client";

import { useState } from "react";

export interface PendingPartnerRequest {
  workspaceId: string;
  workspaceName: string;
  requestedAt: string | null;
}

/** Approve, reject, or assign partner access for a workspace. Changes take effect on the next page load. */
export function PartnerAccessQueue({ initial }: { initial: PendingPartnerRequest[] }) {
  const [pending, setPending] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(workspaceId: string, decision: "approved" | "rejected") {
    setBusy(workspaceId);
    setMessage(null);
    try {
      const response = await fetch("/api/platform/partner-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, decision }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "The decision could not be saved.");
      setPending((rows) => rows.filter((row) => row.workspaceId !== workspaceId));
      setMessage(`${decision === "approved" ? "Approved" : "Rejected"} partner access.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "The decision could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="partner-queue" className="mt-10">
      <h2 id="partner-queue" className="text-lg font-bold">Partner access requests</h2>
      <p className="mb-4 mt-1 text-sm text-[var(--muted)]">Approve a request to show partner solutions to that workspace.</p>
      {message && <p role="status" className="mb-3 text-sm">{message}</p>}
      {pending.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No requests are waiting.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {pending.map((row) => (
            <li key={row.workspaceId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="font-semibold">{row.workspaceName}</p>
                <p className="text-xs text-[var(--muted)]">Requested {row.requestedAt ? new Date(row.requestedAt).toLocaleString("en-IN") : "recently"}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={busy === row.workspaceId} onClick={() => decide(row.workspaceId, "approved")} className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[#0b132a] disabled:opacity-60">Approve</button>
                <button type="button" disabled={busy === row.workspaceId} onClick={() => decide(row.workspaceId, "rejected")} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-60">Reject</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

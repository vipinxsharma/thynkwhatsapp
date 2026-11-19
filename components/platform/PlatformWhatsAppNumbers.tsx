"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlatformWhatsAppNumber } from "@/lib/meta/connections";

export function PlatformWhatsAppNumbers({ rows }: { rows: PlatformWhatsAppNumber[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(row: PlatformWhatsAppNumber) {
    const label = row.displayPhoneNumber || row.phoneNumberId;
    const ok = window.confirm(
      `Remove ${label} from ${row.workspaceName}?\n\nThe number is disconnected from this workspace. Conversations and automation rules stay as history. The tenant can then connect it from their own workspace.`
    );
    if (!ok) return;
    setBusyId(row.phoneNumberId);
    setError(null);
    try {
      const response = await fetch("/api/platform/whatsapp-numbers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: row.workspaceId, phoneNumberId: row.phoneNumberId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error || "Could not remove the number");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not remove the number");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="mb-2 text-lg font-semibold">WhatsApp numbers</h2>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Remove a number from a workspace so it can be connected elsewhere. Conversations and automation rules are kept.
      </p>
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-semibold">Workspace</th>
              <th className="px-5 py-3 font-semibold">Number</th>
              <th className="px-5 py-3 font-semibold">Phone ID</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.workspaceId}:${row.phoneNumberId}`} className="border-b border-[var(--border)] last:border-0">
                <td className="px-5 py-4 font-medium">{row.workspaceName}</td>
                <td className="px-5 py-4">{row.displayPhoneNumber || "—"}</td>
                <td className="px-5 py-4 text-[var(--muted)]">{row.phoneNumberId}</td>
                <td className="px-5 py-4">{row.enabled ? "Enabled" : "Disabled"}</td>
                <td className="px-5 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => void remove(row)}
                    disabled={busyId === row.phoneNumberId}
                    className="rounded-md border border-red-500/60 px-3 py-1.5 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {busyId === row.phoneNumberId ? "Removing…" : "Remove number"}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-[var(--muted)]">No WhatsApp numbers stored.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

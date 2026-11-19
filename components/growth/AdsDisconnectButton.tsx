"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdsDisconnectButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function disconnect() {
    if (!window.confirm("Disconnect the ad account? Thynk will delete its stored access token.")) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/meta/ads/connection", { method: "DELETE" });
      const body = (await res.json().catch(() => null)) as { revokedAtMeta?: boolean; error?: string } | null;
      if (!res.ok) {
        setMessage(body?.error || "Could not disconnect. Try again.");
        return;
      }
      setMessage(
        body?.revokedAtMeta === false
          ? "Disconnected here. Meta did not confirm removal, so also remove Thynk under your Meta business settings."
          : "Disconnected.",
      );
      router.refresh();
    } catch {
      setMessage("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={disconnect}
        disabled={busy}
        className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold text-[var(--heading)] hover:bg-[var(--surface-muted)] disabled:opacity-60"
      >
        {busy ? "Disconnecting…" : "Disconnect ad account"}
      </button>
      {message && <p role="status" className="text-sm text-[var(--muted)]">{message}</p>}
    </div>
  );
}

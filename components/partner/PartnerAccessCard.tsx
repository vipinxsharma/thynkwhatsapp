"use client";

import { useState } from "react";
import type { PartnerAccessStatus } from "@/lib/partner/access";

const messages: Record<PartnerAccessStatus, string> = {
  none: "Partner solutions become available to your workspace once Xeccel approves your request.",
  requested: "Your request is with the Xeccel team. You will see partner solutions here once it is approved.",
  approved: "",
  rejected: "Xeccel could not approve partner solutions for this workspace yet. Contact the Xeccel team for details.",
};

export function PartnerAccessCard({ status, canRequest }: { status: PartnerAccessStatus; canRequest: boolean }) {
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function request() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/partner/access", { method: "POST", headers: { "Content-Type": "application/json" } });
      const payload = (await response.json().catch(() => null)) as { data?: { status: PartnerAccessStatus }; error?: string } | null;
      if (!response.ok || !payload?.data) throw new Error(payload?.error || "The request could not be sent.");
      setCurrent(payload.data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The request could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl p-6 md:p-10 space-y-4">
      <h1 className="text-2xl font-bold text-[var(--heading)]">Partner solutions</h1>
      <p className="text-sm text-[var(--muted)]">{messages[current]}</p>
      {current === "none" && canRequest && (
        <button
          type="button"
          onClick={request}
          disabled={busy}
          className="inline-flex min-h-12 items-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[#0b132a] disabled:opacity-60"
        >
          {busy ? "Sending…" : "Request partner access"}
        </button>
      )}
      {current === "none" && !canRequest && (
        <p className="text-xs text-[var(--muted)]">Only a workspace owner or admin can request partner access.</p>
      )}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </div>
  );
}

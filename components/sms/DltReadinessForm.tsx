"use client";

import { useEffect, useState } from "react";
import type { DltAccessProvider, DltDraft } from "@/lib/sms/dlt";

const providers: { value: DltAccessProvider; label: string }[] = [
  { value: "airtel", label: "Airtel" },
  { value: "vi", label: "Vi" },
  { value: "jio", label: "Jio" },
  { value: "other", label: "Other access provider" },
];

export function DltReadinessForm({ canEdit }: { canEdit: boolean }) {
  const [provider, setProvider] = useState<DltAccessProvider | "">("");
  const [peId, setPeId] = useState("");
  const [partner, setPartner] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/sms/dlt", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load this workspace's draft. Try again later.");
        return response.json() as Promise<{ data: DltDraft | null }>;
      })
      .then(({ data }) => {
        if (!active || !data) return;
        setProvider(data.accessProvider);
        setPeId(data.principalEntityId || "");
        setPartner(data.deliveryPartnerName || "");
      })
      .catch((error: Error) => {
        if (active) {
          setAvailable(false);
          setStatus(error.message);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/sms/dlt", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessProvider: provider, principalEntityId: peId, deliveryPartnerName: partner }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save draft");
      setStatus("Draft saved for this workspace. Xeccel has not verified these details with the provider.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save draft");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-xl font-semibold text-[var(--heading)]">Your DLT readiness draft</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Record the access-provider portal and reference details for this workspace. These are customer-entered notes,
        not a DLT registration, approval check, or SMS sending setup.
      </p>
      <form onSubmit={save} className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-[var(--heading)]">
          <span>DLT access provider</span>
          <select value={provider} onChange={(event) => setProvider(event.target.value as DltAccessProvider)} disabled={!canEdit || loading || !available}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-[var(--foreground)]">
            <option value="">Choose a provider</option>
            {providers.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium text-[var(--heading)]">
          <span>Principal Entity ID, if issued</span>
          <input value={peId} onChange={(event) => setPeId(event.target.value)} maxLength={64} disabled={!canEdit || loading || !available}
            placeholder="Optional, unverified" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-[var(--foreground)]" />
        </label>
        <label className="space-y-2 text-sm font-medium text-[var(--heading)] md:col-span-2">
          <span>Delivery partner or aggregator, if selected</span>
          <input value={partner} onChange={(event) => setPartner(event.target.value)} maxLength={120} disabled={!canEdit || loading || !available}
            placeholder="Optional; separate from the access provider" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-[var(--foreground)]" />
        </label>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          {canEdit && <button type="submit" disabled={loading || saving || !available || !provider}
            className="rounded-lg bg-whatsapp-dark px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save draft"}
          </button>}
          {!canEdit && <p className="text-sm text-[var(--muted)]">Only a workspace owner or admin can edit this draft.</p>}
          <p role="status" className="text-sm text-[var(--muted)]">{loading ? "Loading draft…" : status}</p>
        </div>
      </form>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type Stage = { id: string; name: string; position: number; isDefault: boolean; leadCount: number };
type Lead = {
  id: string;
  contactId: string;
  stageId: string;
  stageName: string;
  name: string;
  phoneNumber: string;
  source: "interactive_button" | "template_button";
  lastButtonText: string;
  campaignRef: string | null;
  tapCount: number;
  firstTappedAt: string;
  lastTappedAt: string;
};

type Filters = { q: string; source: string; from: string; to: string; stageId: string };
const emptyFilters: Filters = { q: "", source: "", from: "", to: "", stageId: "" };

const SOURCE_LABELS: Record<string, string> = {
  interactive_button: "Interactive button",
  template_button: "Template button",
};

function buildQuery(filters: Filters, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({
    q: filters.q.trim(),
    source: filters.source,
    from: filters.from,
    to: filters.to,
    stageId: filters.stageId,
    ...extra,
  })) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function LeadList() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/leads/stages")
      .then((res) => res.json())
      .then((json) => setStages(json.data || []))
      .catch(() => setError("Could not load stages"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/leads?${buildQuery(applied)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not load leads");
        if (!cancelled) {
          setLeads(json.data || []);
          setTruncated(Boolean(json.truncated));
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applied]);

  const onApply = (event: FormEvent) => {
    event.preventDefault();
    setApplied({ ...draft });
  };

  const onClear = () => {
    setDraft(emptyFilters);
    setApplied(emptyFilters);
  };

  return (
    <section className="space-y-4">
      <form onSubmit={onApply} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:grid-cols-6">
        <label className="flex flex-col gap-1 text-xs text-gray-400 md:col-span-2">
          Name or phone
          <input
            value={draft.q}
            onChange={(e) => setDraft({ ...draft, q: e.target.value })}
            placeholder="Search"
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Source
          <select
            value={draft.source}
            onChange={(e) => setDraft({ ...draft, source: e.target.value })}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          >
            <option value="">All sources</option>
            <option value="template_button">Template button</option>
            <option value="interactive_button">Interactive button</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Stage
          <select
            value={draft.stageId}
            onChange={(e) => setDraft({ ...draft, stageId: e.target.value })}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          >
            <option value="">All stages</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>{stage.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Last tap from
          <input
            type="date"
            value={draft.from}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Last tap to
          <input
            type="date"
            value={draft.to}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          />
        </label>
        <div className="flex flex-wrap items-end gap-2 md:col-span-6">
          <button type="submit" className="rounded-lg bg-whatsapp px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Apply filters
          </button>
          <button type="button" onClick={onClear} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-200 hover:border-white/30">
            Clear
          </button>
          <a
            href={`/api/leads?${buildQuery(applied, { format: "csv" })}`}
            className="ml-auto rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-200 hover:border-white/30"
          >
            Export CSV
          </a>
        </div>
      </form>

      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
      {truncated && (
        <p className="text-xs text-amber-200">Showing the most recent 200 leads. Narrow the filters or export CSV for up to 10,000.</p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Last button</th>
              <th className="px-4 py-3 font-medium">Campaign</th>
              <th className="px-4 py-3 font-medium">Taps</th>
              <th className="px-4 py-3 font-medium">Last tap</th>
              <th className="px-4 py-3 font-medium"><span className="sr-only">Contact</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-gray-200">
            {loading && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">Loading leads…</td></tr>
            )}
            {!loading && leads.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">No leads match these filters yet. Leads appear when a contact taps a button in a template or an interactive message.</td></tr>
            )}
            {!loading && leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-white">{lead.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{lead.phoneNumber}</td>
                <td className="px-4 py-3">{lead.stageName}</td>
                <td className="px-4 py-3">{SOURCE_LABELS[lead.source] || lead.source}</td>
                <td className="px-4 py-3">{lead.lastButtonText || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{lead.campaignRef || "—"}</td>
                <td className="px-4 py-3">{lead.tapCount}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatTime(lead.lastTappedAt)}</td>
                <td className="px-4 py-3">
                  <Link href={`/contacts?contact=${lead.contactId}`} className="text-whatsapp hover:underline">
                    Open contact
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState, type DragEvent, type FormEvent } from "react";

type Stage = { id: string; name: string; position: number; isDefault: boolean; leadCount: number };
type Lead = {
  id: string;
  stageId: string;
  name: string;
  phoneNumber: string;
  lastButtonText: string;
  lastTappedAt: string;
  tapCount: number;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...(init?.headers || {}) } : init?.headers,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function StageBoard() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newStageName, setNewStageName] = useState("");
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const load = async () => {
    try {
      const [stageJson, leadJson] = await Promise.all([
        api<{ data: Stage[] }>("/api/leads/stages"),
        api<{ data: Lead[]; truncated?: boolean }>("/api/leads"),
      ]);
      setStages(stageJson.data);
      setLeads(leadJson.data);
      setTruncated(Boolean(leadJson.truncated));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      await load();
    }
  };

  const moveLead = (leadId: string, stageId: string) => {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.stageId === stageId) return;
    // Optimistic update; the reload below restores the server state if the move fails.
    setLeads((current) => current.map((item) => (item.id === leadId ? { ...item, stageId } : item)));
    run(async () => {
      await api(`/api/leads/${leadId}`, { method: "PATCH", body: JSON.stringify({ stageId }) });
      await load();
    });
  };

  const addStage = (event: FormEvent) => {
    event.preventDefault();
    const name = newStageName.trim();
    if (!name) return;
    run(async () => {
      await api("/api/leads/stages", { method: "POST", body: JSON.stringify({ name }) });
      setNewStageName("");
      await load();
    });
  };

  const renameStage = (stage: Stage, rawName: string) => {
    const name = rawName.trim();
    if (!name || name === stage.name) return;
    run(async () => {
      await api("/api/leads/stages", { method: "PATCH", body: JSON.stringify({ id: stage.id, name }) });
      await load();
    });
  };

  const shiftStage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    const order = stages.map((stage) => stage.id);
    [order[index], order[target]] = [order[target], order[index]];
    run(async () => {
      await api("/api/leads/stages", { method: "PUT", body: JSON.stringify({ order }) });
      await load();
    });
  };

  const deleteStage = (stage: Stage) => {
    const message = stage.leadCount > 0
      ? `Delete "${stage.name}"? Its ${stage.leadCount} lead(s) move to ${stages.find((s) => s.isDefault)?.name || "the default stage"}.`
      : `Delete "${stage.name}"?`;
    if (!window.confirm(message)) return;
    run(async () => {
      await api(`/api/leads/stages?id=${stage.id}`, { method: "DELETE" });
      await load();
    });
  };

  const onDragStart = (event: DragEvent<HTMLElement>, leadId: string) => {
    event.dataTransfer.setData("text/plain", leadId);
    event.dataTransfer.effectAllowed = "move";
  };

  const onDrop = (event: DragEvent<HTMLElement>, stageId: string) => {
    event.preventDefault();
    setDragOverStage(null);
    const leadId = event.dataTransfer.getData("text/plain");
    if (leadId) moveLead(leadId, stageId);
  };

  if (loading) return <p className="text-sm text-gray-400">Loading stage board…</p>;

  return (
    <section className="space-y-4">
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
      {truncated && (
        <p className="text-xs text-amber-200">The board shows the most recent 200 leads. Use the lead list to find older ones.</p>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage, index) => {
          const columnLeads = leads.filter((lead) => lead.stageId === stage.id);
          return (
            <div
              key={stage.id}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverStage(stage.id);
              }}
              onDragLeave={() => setDragOverStage((current) => (current === stage.id ? null : current))}
              onDrop={(event) => onDrop(event, stage.id)}
              className={`flex w-72 shrink-0 flex-col rounded-2xl border bg-white/[0.02] p-3 ${
                dragOverStage === stage.id ? "border-whatsapp" : "border-white/10"
              }`}
            >
              <header className="mb-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    key={`${stage.id}-${stage.name}`}
                    defaultValue={stage.name}
                    aria-label={`Stage name for ${stage.name}`}
                    maxLength={60}
                    onBlur={(event) => renameStage(stage, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                    }}
                    className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-white hover:border-white/10 focus:border-whatsapp focus:outline-none"
                  />
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-300">{columnLeads.length}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <button type="button" aria-label={`Move ${stage.name} left`} disabled={index === 0} onClick={() => shiftStage(index, -1)} className="rounded px-2 py-1 hover:bg-white/10 disabled:opacity-30">←</button>
                  <button type="button" aria-label={`Move ${stage.name} right`} disabled={index === stages.length - 1} onClick={() => shiftStage(index, 1)} className="rounded px-2 py-1 hover:bg-white/10 disabled:opacity-30">→</button>
                  {stage.isDefault ? (
                    <span className="ml-auto text-[11px] uppercase tracking-wide text-gray-500">Default</span>
                  ) : (
                    <button type="button" onClick={() => deleteStage(stage)} className="ml-auto rounded px-2 py-1 text-red-300 hover:bg-red-500/10">Delete</button>
                  )}
                </div>
              </header>

              <ul className="flex min-h-[120px] flex-1 flex-col gap-2">
                {columnLeads.map((lead) => (
                  <li
                    key={lead.id}
                    draggable
                    onDragStart={(event) => onDragStart(event, lead.id)}
                    className="cursor-grab rounded-xl border border-white/10 bg-black/30 p-3 text-sm active:cursor-grabbing"
                  >
                    <p className="font-medium text-white">{lead.name}</p>
                    <p className="font-mono text-xs text-gray-400">{lead.phoneNumber}</p>
                    <p className="mt-2 text-xs text-gray-300">
                      “{lead.lastButtonText || "—"}” · {lead.tapCount} tap{lead.tapCount === 1 ? "" : "s"}
                    </p>
                    <p className="text-[11px] text-gray-500">{formatTime(lead.lastTappedAt)}</p>
                    <label className="mt-2 block text-[11px] text-gray-400">
                      Stage
                      <select
                        value={lead.stageId}
                        onChange={(event) => moveLead(lead.id, event.target.value)}
                        className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
                      >
                        {stages.map((option) => (
                          <option key={option.id} value={option.id}>{option.name}</option>
                        ))}
                      </select>
                    </label>
                  </li>
                ))}
                {columnLeads.length === 0 && (
                  <li className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-gray-500">Drop a lead here</li>
                )}
              </ul>
            </div>
          );
        })}

        <form onSubmit={addStage} className="flex w-72 shrink-0 flex-col gap-2 rounded-2xl border border-dashed border-white/15 p-3">
          <label className="text-xs text-gray-400" htmlFor="new-stage-name">Add a stage</label>
          <input
            id="new-stage-name"
            value={newStageName}
            maxLength={60}
            onChange={(event) => setNewStageName(event.target.value)}
            placeholder="e.g. Qualified"
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          />
          <button type="submit" disabled={!newStageName.trim()} className="rounded-lg bg-whatsapp px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40">
            Add stage
          </button>
        </form>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";

type Note = { id: string; body: string; authorAuthUserId: string; createdAt: string };

// Internal notes are visible only to the team; they are never sent to the customer.
export function AgentNotesPanel({ conversationId, labelFor }: {
  conversationId: string;
  labelFor: (authUserId: string) => string;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch(`/api/inbox/notes?conversationId=${encodeURIComponent(conversationId)}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load notes");
        setNotes(result.data as Note[]);
      })
      .catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not load notes"); });
    return () => controller.abort();
  }, [conversationId]);

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/inbox/notes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, body }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save note");
      setNotes((current) => [...current, result.data as Note]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Internal notes" className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Internal notes</h3>
      {notes.length === 0 && <p className="text-xs text-[var(--muted)]">No notes yet.</p>}
      <ul className="space-y-2">
        {notes.map((note) => (
          <li key={note.id} className="rounded-lg border border-[var(--border)] p-2 text-xs">
            <p className="whitespace-pre-wrap">{note.body}</p>
            <p className="mt-1 text-[10px] text-[var(--muted)]">
              {labelFor(note.authorAuthUserId)} · {new Date(note.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
      <form onSubmit={addNote} className="space-y-2">
        <label htmlFor="inbox-note" className="sr-only">Add an internal note</label>
        <textarea id="inbox-note" value={draft} maxLength={2000} rows={2} onChange={(e) => setDraft(e.target.value)}
          placeholder="Only your team can see this" className="w-full rounded-lg border border-[var(--border)] bg-transparent p-2 text-xs" />
        <button type="submit" disabled={!draft.trim() || busy}
          className="min-h-9 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold disabled:opacity-50">
          {busy ? "Saving..." : "Add note"}
        </button>
      </form>
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </section>
  );
}

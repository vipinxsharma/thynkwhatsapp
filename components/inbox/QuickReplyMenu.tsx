"use client";

import { useEffect, useState } from "react";

type QuickReply = { id: string; title: string; body: string };

// Lists saved replies and inserts one into the composer. Creating replies is an admin-free action for agents.
export function QuickReplyMenu({ onPick, canDelete }: {
  onPick: (body: string) => void;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/inbox/quick-replies")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load quick replies");
        setReplies(result.data as QuickReply[]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load quick replies"));
  }, [open]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/inbox/quick-replies", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Could not save quick reply"); return; }
    setReplies((current) => [...current, result.data as QuickReply].sort((a, b) => a.title.localeCompare(b.title)));
    setTitle(""); setBody("");
  }

  async function remove(id: string) {
    const response = await fetch(`/api/inbox/quick-replies?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) { setError("Could not delete quick reply"); return; }
    setReplies((current) => current.filter((reply) => reply.id !== id));
  }

  return (
    <div className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}
        className="min-h-9 rounded-lg border border-white/10 px-2.5 text-xs font-semibold">
        Quick replies
      </button>
      {open && (
        <div role="menu" className="absolute bottom-10 left-0 z-30 w-72 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl">
          {replies.length === 0 && <p className="text-xs text-[var(--muted)]">No quick replies yet.</p>}
          {replies.map((reply) => (
            <div key={reply.id} className="flex items-start justify-between gap-2">
              <button type="button" role="menuitem" onClick={() => { onPick(reply.body); setOpen(false); }}
                className="min-w-0 flex-1 text-left text-xs">
                <span className="block font-semibold">{reply.title}</span>
                <span className="block truncate text-[var(--muted)]">{reply.body}</span>
              </button>
              {canDelete && <button type="button" onClick={() => remove(reply.id)} className="text-[10px] text-red-300">Delete</button>}
            </div>
          ))}
          <form onSubmit={create} className="space-y-1 border-t border-[var(--border)] pt-2">
            <input aria-label="Quick reply title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)}
              placeholder="Title" className="w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-xs" />
            <textarea aria-label="Quick reply text" value={body} maxLength={1024} rows={2} onChange={(e) => setBody(e.target.value)}
              placeholder="Reply text" className="w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-xs" />
            <button type="submit" disabled={!title.trim() || !body.trim()} className="text-xs font-semibold disabled:opacity-50">Save quick reply</button>
          </form>
          {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
        </div>
      )}
    </div>
  );
}

"use client";
import { useCallback, useEffect, useState } from "react";

type Settings = {
  unsubscribeKeyword: string | null;
  handoverKeyword: string | null;
  handoverMessage: string | null;
  holdingMessage: string | null;
};
type BlockedNumber = { waId: string; createdAt: string };

const empty: Settings = { unsubscribeKeyword: null, handoverKeyword: null, handoverMessage: null, holdingMessage: null };
const field = "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

export default function ChatSettingsPage() {
  const [draft, setDraft] = useState<Settings>(empty);
  const [blocked, setBlocked] = useState<BlockedNumber[]>([]);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/chat-settings", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chat settings are unavailable");
      setDraft({ ...empty, ...data.settings });
      setBlocked(data.blockedNumbers);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chat settings are unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function text(value: string | null) {
    return value ?? "";
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/chat-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chat settings could not be saved");
      setDraft({ ...empty, ...data.settings });
      setNotice("Chat settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Chat settings could not be saved");
    } finally {
      setBusy(false);
    }
  }

  async function blockNumber(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/chat-settings/blocked", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Number could not be blocked");
      setBlocked(data.blockedNumbers);
      setPhone("");
      setNotice("Number blocked. Its messages are still stored, but they are not answered.");
    } catch (blockError) {
      setError(blockError instanceof Error ? blockError.message : "Number could not be blocked");
    } finally {
      setBusy(false);
    }
  }

  async function unblock(waId: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/chat-settings/blocked?waId=${encodeURIComponent(waId)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Number could not be unblocked");
      setBlocked(data.blockedNumbers);
      setNotice("Number unblocked.");
    } catch (unblockError) {
      setError(unblockError instanceof Error ? unblockError.message : "Number could not be unblocked");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 text-[var(--foreground)]">
      <header>
        <h1 className="text-2xl font-bold">Chat settings</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Control how the inbox handles stop requests, hand-overs to a person, blocked numbers and delayed replies.
          Only workspace owners and administrators can change these settings.
        </p>
      </header>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      {notice && <p role="status" className="text-[var(--accent-text)]">{notice}</p>}
      {loading ? <p role="status">Loading chat settings…</p> : (
        <div className="grid gap-6 xl:grid-cols-2">
          <form onSubmit={save} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-5">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Unsubscribe keyword</h2>
              <p className="text-sm text-[var(--muted)]">When a contact sends exactly this word, they are opted out of marketing messages and bot replies stop for that message.</p>
              <label className="block text-sm space-y-1"><span>Keyword</span>
                <input maxLength={40} className={field} placeholder="STOP" value={text(draft.unsubscribeKeyword)}
                  onChange={(e) => setDraft({ ...draft, unsubscribeKeyword: e.target.value || null })} />
              </label>
            </section>
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Hand over to a person</h2>
              <p className="text-sm text-[var(--muted)]">When a contact sends exactly this word, the chat moves to pending and bot replies stop until an agent reopens it.</p>
              <label className="block text-sm space-y-1"><span>Keyword</span>
                <input maxLength={40} className={field} placeholder="AGENT" value={text(draft.handoverKeyword)}
                  onChange={(e) => setDraft({ ...draft, handoverKeyword: e.target.value || null })} />
              </label>
              <label className="block text-sm space-y-1"><span>Message sent on hand-over</span>
                <textarea maxLength={1024} rows={3} className={field} value={text(draft.handoverMessage)}
                  onChange={(e) => setDraft({ ...draft, handoverMessage: e.target.value || null })} />
              </label>
            </section>
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Holding message</h2>
              <p className="text-sm text-[var(--muted)]">Sent when a contact writes to a chat that is waiting for a person, so they know a reply is coming. At most one every 12 hours per chat.</p>
              <label className="block text-sm space-y-1"><span>Message</span>
                <textarea maxLength={1024} rows={3} className={field} value={text(draft.holdingMessage)}
                  onChange={(e) => setDraft({ ...draft, holdingMessage: e.target.value || null })} />
              </label>
            </section>
            <div className="flex gap-4">
              <button disabled={busy} className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-50">
                {busy ? "Saving…" : "Save chat settings"}
              </button>
            </div>
          </form>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
            <h2 className="text-lg font-semibold">Blocked numbers</h2>
            <p className="text-sm text-[var(--muted)]">Messages from blocked numbers are stored in the inbox, but no bot replies, keyword actions or hand-over messages are sent to them.</p>
            <form onSubmit={blockNumber} className="flex gap-3">
              <label className="flex-1 text-sm space-y-1"><span className="sr-only">Phone number</span>
                <input required className={field} placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <button disabled={busy || !phone.trim()} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50">Block number</button>
            </form>
            {!blocked.length ? <p className="text-sm text-[var(--muted)]">No numbers are blocked.</p> : (
              <ul className="divide-y divide-[var(--border)] text-sm">
                {blocked.map((item) => (
                  <li key={item.waId} className="flex items-center justify-between py-2">
                    <span>+{item.waId}</span>
                    <button disabled={busy} onClick={() => unblock(item.waId)} className="underline">Unblock</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

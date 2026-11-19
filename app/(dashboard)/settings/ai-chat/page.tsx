"use client";
import { useCallback, useEffect, useState } from "react";

type Settings = {
  enabled: boolean;
  faqText: string | null;
  handoverContact: string | null;
  updatedAt: string | null;
};

const empty: Settings = { enabled: false, faqText: null, handoverContact: null, updatedAt: null };
const field = "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";
const FAQ_LIMIT = 4000;

export default function AiChatSettingsPage() {
  const [draft, setDraft] = useState<Settings>(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/ai/chat-settings", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI chat settings are unavailable");
      setDraft({ ...empty, ...data.settings });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "AI chat settings are unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/ai/chat-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: draft.enabled,
          faq_text: draft.faqText ?? "",
          handover_contact: draft.handoverContact ?? "",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI chat settings could not be saved");
      setDraft({ ...empty, ...data.settings });
      setNotice("AI chat settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "AI chat settings could not be saved");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading AI chat settings…</p>;

  return (
    <form onSubmit={save} className="max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">AI chat replies</h1>
        <p className="text-sm text-[var(--muted)]">
          When this is on, an inbound text message inside the 24-hour window can get an automatic reply.
          Replies only repeat your FAQ or catalogue text. If the question is about money, refunds, a complaint,
          legal or health, asks for a person, or has no clear answer, the conversation is moved to pending
          for your team and nothing is sent.
        </p>
        <p className="text-sm font-medium">
          Replies are sent automatically inside the 24-hour window. Your business stays responsible for what is said
          to customers, so keep the FAQ accurate and review it regularly. Customers who send STOP get no more automated replies.
        </p>
      </header>

      <label className="flex items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
        />
        Send AI replies automatically
      </label>

      <div className="space-y-2">
        <label htmlFor="faq" className="text-sm font-medium">FAQ</label>
        <p className="text-xs text-[var(--muted)]">
          One entry per block. Start the question with <code>Q:</code> and the answer with <code>A:</code>.
          Only this text can be sent. Leave out prices unless you want them quoted exactly.
        </p>
        <textarea
          id="faq"
          rows={12}
          maxLength={FAQ_LIMIT}
          className={field}
          placeholder={"Q: What are your opening hours?\nA: We are open 10am to 6pm, Monday to Saturday."}
          value={draft.faqText ?? ""}
          onChange={(event) => setDraft({ ...draft, faqText: event.target.value })}
        />
        <p className="text-xs text-[var(--muted)]">{(draft.faqText ?? "").length} / {FAQ_LIMIT}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="handover" className="text-sm font-medium">Handover contact (for your team)</label>
        <input
          id="handover"
          maxLength={200}
          className={field}
          value={draft.handoverContact ?? ""}
          onChange={(event) => setDraft({ ...draft, handoverContact: event.target.value })}
        />
        <p className="text-xs text-[var(--muted)]">Saved for your reference. It is not sent to customers automatically.</p>
      </div>

      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-[var(--primary,#111)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

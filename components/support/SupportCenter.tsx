"use client";

import { useState } from "react";
import type { SupportCase, SupportMessage } from "@/lib/support/store";

export function SupportCenter({ initialCases }: { initialCases: SupportCase[] }) {
  const [cases, setCases] = useState(initialCases);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [selectedCase, setSelectedCase] = useState<SupportCase | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState("");
  const [aiPending, setAiPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/support/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    const payload = await response.json();
    if (!response.ok) setError(payload.error || "Unable to create the support case");
    else {
      setCases((current) => [payload.data, ...current]);
      setSubject("");
      setBody("");
    }
    setPending(false);
  }

  async function openCase(item: SupportCase) {
    setSelectedCase(item);
    setError("");
    const response = await fetch(`/api/support/cases/${item.id}/messages`);
    const payload = await response.json();
    if (!response.ok) setError(payload.error || "Unable to open the support case");
    else setMessages(payload.data);
  }

  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedCase) return;
    setPending(true);
    setError("");
    const response = await fetch(`/api/support/cases/${selectedCase.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply }),
    });
    const payload = await response.json();
    if (!response.ok) setError(payload.error || "Unable to send the message");
    else {
      setMessages((current) => [...current, payload.data]);
      setReply("");
    }
    setPending(false);
  }

  async function requestAIReview() {
    if (!selectedCase) return;
    setAiPending(true);
    setError("");
    const response = await fetch(`/api/support/cases/${selectedCase.id}/resolve`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) setError(payload.error || "AI assistance is unavailable");
    else {
      setMessages((current) => [...current, payload.data.message]);
      setSelectedCase((current) => current ? { ...current, status: payload.data.status } : current);
      setCases((current) => current.map((item) => item.id === selectedCase.id ? { ...item, status: payload.data.status } : item));
    }
    setAiPending(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-white/10 bg-[#0d1117] p-5">
        <div>
          <h2 className="font-semibold text-white">Ask for help</h2>
          <p className="mt-1 text-xs text-gray-400">Your case stays within this workspace.</p>
        </div>
        <input value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={200} placeholder="What do you need help with?" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm" />
        <textarea value={body} onChange={(event) => setBody(event.target.value)} required maxLength={10000} rows={6} placeholder="Describe the issue and what you expected to happen." className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm" />
        {error && <p className="text-xs text-red-300">{error}</p>}
        <button disabled={pending} className="rounded-lg bg-whatsapp px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{pending ? "Creating…" : "Start support chat"}</button>
      </form>

      <section className="rounded-xl border border-white/10 bg-[#0d1117] p-5">
        <h2 className="font-semibold text-white">Your support cases</h2>
        <div className="mt-4 space-y-3">
          {cases.length === 0 && <p className="text-sm text-gray-400">No support cases yet.</p>}
          {cases.map((item) => (
            <button type="button" onClick={() => openCase(item)} key={item.id} className="w-full rounded-lg border border-white/5 bg-black/20 p-4 text-left hover:border-white/15">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{item.subject}</p>
                <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase text-gray-300">{item.status.replace("_", " ")}</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">Opened through {item.sourceChannel}</p>
            </button>
          ))}
        </div>
      </section>

      {selectedCase && (
        <section className="lg:col-start-2 rounded-xl border border-white/10 bg-[#0d1117] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-white">{selectedCase.subject}</h2>
            <button type="button" onClick={requestAIReview} disabled={aiPending} className="rounded-lg border border-whatsapp/40 px-3 py-2 text-xs font-semibold text-whatsapp disabled:opacity-50">
              {aiPending ? "Reviewing…" : "Ask AI to resolve"}
            </button>
          </div>
          <div className="my-4 max-h-96 space-y-3 overflow-y-auto">
            {messages.map((message) => (
              <div key={message.id} className={`rounded-lg p-3 text-sm ${message.senderType === "customer" ? "ml-8 bg-whatsapp/10" : "mr-8 bg-white/5"}`}>
                <p className="mb-1 text-[10px] uppercase text-gray-500">{message.senderType}</p>
                <p className="whitespace-pre-wrap text-gray-200">{message.body}</p>
              </div>
            ))}
          </div>
          <form onSubmit={sendReply} className="flex gap-2">
            <input value={reply} onChange={(event) => setReply(event.target.value)} required maxLength={10000} placeholder="Add a message" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm" />
            <button disabled={pending} className="rounded-lg bg-whatsapp px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Send</button>
          </form>
        </section>
      )}
    </div>
  );
}

"use client";
import { useCallback, useEffect, useState } from "react";
import type { WhatsAppChannel } from "@/lib/meta/connections";
import type { RoutingInput, RoutingRule } from "@/lib/automations/routing";

type Run = { id: string; ruleName: string; conversationId: string; actions: {tags: string[]; conversationStatus: string | null}; createdAt: string };
const empty: RoutingInput = { name: "", channelId: null, matchType: "contains", keywords: [], tags: [], conversationStatus: null, priority: 100, enabled: false };
const field = "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";
export default function AutomationsPage() {
  const [channels,setChannels] = useState<WhatsAppChannel[]>([]), [channelError,setChannelError] = useState("");
  const [rules,setRules] = useState<RoutingRule[]>([]), [runs,setRuns] = useState<Run[]>([]);
  const [draft,setDraft] = useState<RoutingInput>(empty), [editing,setEditing] = useState<string | null>(null);
  const [keywords,setKeywords] = useState(""), [tags,setTags] = useState("");
  const [error,setError] = useState(""), [notice,setNotice] = useState(""), [busy,setBusy] = useState(false), [loading,setLoading] = useState(true);
  const [testText,setTestText] = useState(""), [testChannel,setTestChannel] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/automations", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRules(data.data); setRuns(data.runs);
    } catch(error) { setError(error instanceof Error ? error.message : "Unable to load rules"); }
    finally { setLoading(false); }
  },[]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/channels/whatsapp", {cache:"no-store",signal:controller.signal}).then(async response=>{
      if (!response.ok) throw new Error("Unable to load channels. Check your channel connection settings.");
      const result = await response.json(); setChannels(result.data.filter((channel:WhatsAppChannel)=>channel.enabled));
    }).catch(error=>{if(!controller.signal.aborted)setChannelError(error.message);});
    return ()=>controller.abort();
  },[]);
  async function request(method: string, body?: unknown, suffix = "") {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/automations${suffix}`, {method,headers:{"Content-Type":"application/json"},body:body ? JSON.stringify(body):undefined});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save");
      return data;
    } catch(error) { setError(error instanceof Error ? error.message : "Request failed"); return null; }
    finally { setBusy(false); }
  }
  function edit(rule: RoutingRule) { setDraft(rule); setEditing(rule.id); setKeywords(rule.keywords.join(", ")); setTags(rule.tags.join(", ")); }
  function reset() { setDraft(empty); setEditing(null); setKeywords(""); setTags(""); }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const result = await request(editing ? "PUT" : "POST", {...draft,id:editing,keywords:keywords.split(",").map(x=>x.trim()).filter(Boolean),tags:tags.split(",").map(x=>x.trim()).filter(Boolean)});
    if (result) { reset(); setNotice("Rule saved to your workspace."); await load(); }
  }
  return <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 text-[var(--foreground)]">
    <header><h1 className="text-2xl font-bold">Automations</h1><p className="mt-2 text-sm text-[var(--muted)]">Route incoming WhatsApp messages with saved keyword rules. The first matching enabled rule applies tags and a conversation status.</p></header>
    <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">Rules run on verified inbound text messages received within the last 24 hours. Lower priority numbers run first. Automated replies, sequences, and visual chatbot flows are not available in this routing release.</p>
    {error && <p role="alert" className="text-red-600">{error}</p>}{notice && <p role="status" className="text-[var(--accent-text)]">{notice}</p>}
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="space-y-4"><h2 className="text-lg font-semibold">Workspace rules</h2>
        {loading ? <p role="status">Loading rules…</p> : !rules.length ? <p className="text-sm text-[var(--muted)]">No rules yet. Create a rule, test it, then enable it.</p> : rules.map(rule=><article key={rule.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
          <div className="flex justify-between gap-3"><h3 className="font-semibold">{rule.name}</h3><span className="text-sm">{rule.enabled ? "Enabled" : "Paused"}</span></div>
          <p className="text-sm text-[var(--muted)]">Priority {rule.priority} · {rule.channelId ? (channels.find(c=>c.phoneNumberId===rule.channelId)?.channelName || "Selected channel") : "All workspace channels"}</p>
          <p className="text-sm">{rule.matchType === "exact" ? "Exactly matches" : "Contains"}: {rule.keywords.join(", ")}</p>
          <p className="text-sm">{rule.tags.length ? `Add tags: ${rule.tags.join(", ")}. ` : ""}{rule.conversationStatus ? `Set status: ${rule.conversationStatus}.` : ""}</p>
          <div className="flex gap-4 text-sm"><button disabled={busy} onClick={()=>edit(rule)} className="underline">Edit</button><button disabled={busy} onClick={async()=>{if(await request("PUT",{...rule,enabled:!rule.enabled})) await load();}} className="underline">{rule.enabled ? "Pause" : "Enable"}</button><button disabled={busy} onClick={async()=>{if(!window.confirm(`Delete ${rule.name}? Execution history will be retained.`)) return;if(await request("DELETE",undefined,`?id=${rule.id}`)){if(editing===rule.id)reset();await load();}}} className="text-red-600 underline">Delete</button></div>
        </article>)}
      </section>
      <form onSubmit={save} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
        <h2 className="text-lg font-semibold">{editing ? "Edit rule" : "Create routing rule"}</h2>
        <label className="block text-sm space-y-1"><span>Name</span><input required maxLength={120} className={field} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
        <label className="block text-sm space-y-1"><span>WhatsApp channel</span><select className={field} value={draft.channelId || ""} onChange={e=>setDraft({...draft,channelId:e.target.value || null})}><option value="">All workspace channels</option>{draft.channelId && !channels.some(c=>c.phoneNumberId===draft.channelId) && <option value={draft.channelId}>Previously selected channel (unavailable)</option>}{channels.map(c=><option key={c.phoneNumberId} value={c.phoneNumberId}>{c.channelName} {c.displayPhoneNumber}</option>)}</select></label>
        {channelError && <p className="text-sm text-red-600">{channelError}</p>}
        <a className="inline-block text-sm underline text-[var(--accent-text)]" href="/settings/waba">Manage WhatsApp channels</a>
        <label className="block text-sm space-y-1"><span>Match type</span><select className={field} value={draft.matchType} onChange={e=>setDraft({...draft,matchType:e.target.value as RoutingInput["matchType"]})}><option value="contains">Contains keyword</option><option value="exact">Exact message</option></select></label>
        <label className="block text-sm space-y-1"><span>Keywords, separated by commas</span><input required className={field} value={keywords} onChange={e=>setKeywords(e.target.value)} /></label>
        <label className="block text-sm space-y-1"><span>Tags to add, separated by commas</span><input className={field} value={tags} onChange={e=>setTags(e.target.value)} /></label>
        <label className="block text-sm space-y-1"><span>Conversation status</span><select className={field} value={draft.conversationStatus || ""} onChange={e=>setDraft({...draft,conversationStatus:e.target.value as RoutingInput["conversationStatus"] || null})}><option value="">Keep current status</option>{["open","pending","closed"].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
        <label className="block text-sm space-y-1"><span>Priority (0–1000)</span><input type="number" min={0} max={1000} className={field} value={draft.priority} onChange={e=>setDraft({...draft,priority:Number(e.target.value)})}/></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.enabled} onChange={e=>setDraft({...draft,enabled:e.target.checked})}/>Enable for new inbound messages</label>
        <div className="flex gap-4"><button disabled={busy || loading || rules.length>=200 && !editing} className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save rule"}</button>{editing && <button type="button" onClick={reset}>Cancel</button>}</div><p className="text-xs text-[var(--muted)]">Workspace owners and administrators can change rules.</p>
      </form>
    </div>
    <form onSubmit={async e=>{e.preventDefault();const result=await request("POST",{action:"test",text:testText,channelId:testChannel});if(result)setNotice(result.rule ? `Simulation: ${result.rule.name} would match. No actions were applied.` : "Simulation: no enabled rule matches. No actions were applied.");}} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
      <h2 className="text-lg font-semibold">Test saved enabled rules</h2><label className="block text-sm">Incoming message<input required className={field} value={testText} onChange={e=>setTestText(e.target.value)}/></label><label className="block text-sm">Receiving channel<select className={field} value={testChannel} onChange={e=>setTestChannel(e.target.value)}><option value="">Test rules for all channels</option>{channels.map(c=><option key={c.phoneNumberId} value={c.phoneNumberId}>{c.channelName} {c.displayPhoneNumber}</option>)}</select></label><button disabled={busy || loading} className="underline text-[var(--accent-text)]">Run simulation</button>
    </form>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Recent executions</h2>{!runs.length ? <p className="text-sm text-[var(--muted)]">No executions recorded. Simulations do not appear here.</p> : runs.map(run=><article key={run.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"><strong>{run.ruleName}</strong><p>{new Date(run.createdAt).toLocaleString()} · Tags: {run.actions.tags.join(", ") || "none"} · Status: {run.actions.conversationStatus || "unchanged"}</p><p className="text-xs text-[var(--muted)]">Conversation {run.conversationId}</p></article>)}</section>
  </main>;
}

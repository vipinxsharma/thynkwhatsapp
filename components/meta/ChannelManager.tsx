"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EmbeddedSignupButton } from "./EmbeddedSignupButton";
import type { WhatsAppChannel } from "@/lib/meta/connections";

export function ChannelManager({ initialChannels, durable, canManage }: {
  initialChannels: WhatsAppChannel[]; durable: boolean; canManage: boolean;
}) {
  const router = useRouter();
  const [channels, setChannels] = useState(initialChannels);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => setChannels(initialChannels), [initialChannels]);

  async function act(phoneNumberId: string, action: "rename" | "make_default" | "refresh") {
    setBusyId(phoneNumberId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/channels/whatsapp", {
        method: action === "refresh" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId, action, name: names[phoneNumberId] ?? channels.find((c) => c.phoneNumberId === phoneNumberId)?.channelName }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Channel update failed");
      setChannels(result.data);
      setNotice(action === "refresh"
        ? "Meta inventory refreshed. This does not verify live messaging delivery."
        : "Channel settings saved.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Channel update failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="flex-1 overflow-y-auto p-8 space-y-6 max-w-5xl">
      <header className="border-b border-white/10 pb-5">
        <p className="text-xs uppercase tracking-widest text-orange-300">Settings · Channels</p>
        <h1 className="mt-2 text-2xl font-bold text-white">WhatsApp channels</h1>
        <p className="mt-2 text-sm text-gray-400">Manage sender numbers in one workspace. A saved connection is not proof of Meta approval or live delivery.</p>
      </header>
      {!durable && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        Durable account storage is not configured. No live channels are shown or connected here.
      </p>}
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</p>}
      <section className="rounded-2xl border border-white/10 bg-surface-100/60 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Add a WhatsApp number</h2>
            <p className="mt-1 max-w-xl text-sm text-gray-400">An owner or admin connects a number through Meta Embedded Signup. Meta must confirm WABA ownership before Xeccel stores it.</p>
          </div>
          {durable && canManage && <EmbeddedSignupButton onSuccess={() => router.refresh()} />}
        </div>
      </section>
      <section className="space-y-4" aria-label="Connected WhatsApp numbers">
        <h2 className="text-lg font-semibold text-white">Connected numbers ({channels.length})</h2>
        {!channels.length && <p className="rounded-2xl border border-white/10 p-6 text-sm text-gray-400">No WhatsApp number is recorded for this workspace.</p>}
        {channels.map((channel) => (
          <article key={channel.phoneNumberId} className="rounded-2xl border border-white/10 bg-surface-100/60 p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-white">{channel.channelName || channel.displayPhoneNumber || channel.phoneNumberId}</h3>
                  {channel.isDefault && <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs text-orange-200">Default sender</span>}
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-300">{channel.enabled ? "Stored connection" : "Disabled locally"}</span>
                </div>
                <p className="mt-1 text-sm text-gray-300">{channel.displayPhoneNumber || "Number not returned by Meta"} · {channel.verifiedName || "Display name unknown"}</p>
                <p className="mt-1 text-xs text-gray-500">WABA {channel.wabaId} · Phone ID {channel.phoneNumberId}</p>
              </div>
              {canManage && !channel.isDefault && <button type="button" disabled={busyId !== null}
                onClick={() => act(channel.phoneNumberId, "make_default")}
                className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white hover:bg-white/10 disabled:opacity-50">Make default</button>}
            </div>
            <div className="grid gap-3 text-xs text-gray-300 sm:grid-cols-3">
              <p>Meta inventory: <strong>{channel.metaStatus === "LISTED_BY_META" ? "Listed at last check" : "Not checked"}</strong></p>
              <p>Quality: <strong>{channel.qualityRating || "Unknown"}</strong></p>
              <p>Code verification: <strong>{channel.codeVerificationStatus || "Unknown"}</strong></p>
            </div>
            <p className="text-xs text-gray-500">Last Meta check: {channel.lastSyncedAt ? new Date(channel.lastSyncedAt).toLocaleString() : "Never"}. Live send and receive need separate verification.</p>
            {canManage && <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
              <button type="button" disabled={busyId !== null} onClick={() => act(channel.phoneNumberId, "refresh")}
                className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15 disabled:opacity-50">Check with Meta</button>
              <label className="sr-only" htmlFor={`name-${channel.phoneNumberId}`}>Channel name</label>
              <input id={`name-${channel.phoneNumberId}`} maxLength={60} value={names[channel.phoneNumberId] ?? channel.channelName}
                onChange={(event) => setNames((current) => ({ ...current, [channel.phoneNumberId]: event.target.value }))}
                placeholder="Channel name, e.g. Support" className="min-w-48 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white" />
              <button type="button" disabled={busyId !== null} onClick={() => act(channel.phoneNumberId, "rename")}
                className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white hover:bg-white/10 disabled:opacity-50">Save name</button>
            </div>}
          </article>
        ))}
      </section>
      <p className="text-xs text-gray-500">Changing the default sender does not move existing conversations. To replace a number, connect and verify the new number first; Meta ownership, templates, and traffic cutover remain separate steps.</p>
    </main>
  );
}

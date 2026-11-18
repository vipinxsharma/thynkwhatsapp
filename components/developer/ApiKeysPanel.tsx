"use client";

import { useCallback, useEffect, useState } from "react";

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function ApiKeysPanel({ canManage }: { canManage: boolean }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [name, setName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/developer/api-keys", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Unable to load API keys");
      return;
    }
    setKeys(payload.data || []);
  }, []);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  async function createKey(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setCopied(false);
    const response = await fetch("/api/developer/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Unable to create the API key");
    } else {
      setRevealedKey(payload.key);
      setName("");
      await load();
    }
    setPending(false);
  }

  async function revokeKey(key: ApiKeyRow) {
    if (!window.confirm(`Revoke "${key.name}"? Any system using it will stop working immediately.`)) return;
    setError("");
    const response = await fetch(`/api/developer/api-keys/${key.id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error || "Unable to revoke the API key");
    await load();
  }

  async function copyKey() {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey);
      setCopied(true);
    } catch {
      setError("Copy failed. Select the key and copy it manually.");
    }
  }

  if (!canManage) {
    return <p className="text-sm text-[var(--muted)]">Only workspace owners and admins can create or revoke API keys.</p>;
  }

  return (
    <div className="space-y-5">
      {revealedKey && (
        <div role="alert" className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-[var(--heading)]">Copy this key now. You will not be able to see it again.</p>
          <code className="block break-all rounded-lg bg-[var(--surface-muted)] p-3 font-mono text-xs text-[var(--foreground)]">{revealedKey}</code>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyKey} className="min-h-10 rounded-lg bg-whatsapp px-4 text-sm font-semibold text-black">
              {copied ? "Copied" : "Copy key"}
            </button>
            <button type="button" onClick={() => setRevealedKey(null)} className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)]">
              I have saved it
            </button>
          </div>
        </div>
      )}

      <form onSubmit={createKey} className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm font-medium text-[var(--foreground)]">
          Key name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
            placeholder="for example: Order system"
            className="min-h-10 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--foreground)]"
          />
        </label>
        <button type="submit" disabled={pending || !name.trim()} className="min-h-10 rounded-lg bg-whatsapp px-4 text-sm font-semibold text-black disabled:opacity-50">
          {pending ? "Creating…" : "Create API key"}
        </button>
      </form>

      {error && <p role="status" className="text-sm text-red-400">{error}</p>}

      {keys.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No API keys yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="py-2 pr-3 font-semibold">Name</th>
                <th className="py-2 pr-3 font-semibold">Key</th>
                <th className="py-2 pr-3 font-semibold">Created</th>
                <th className="py-2 pr-3 font-semibold">Last used</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-t border-[var(--border)]">
                  <td className="py-3 pr-3 text-[var(--heading)]">{key.name}</td>
                  <td className="py-3 pr-3 font-mono text-xs text-[var(--muted)]">{key.prefix}…</td>
                  <td className="py-3 pr-3 text-[var(--muted)]">{formatDate(key.createdAt)}</td>
                  <td className="py-3 pr-3 text-[var(--muted)]">{formatDate(key.lastUsedAt)}</td>
                  <td className="py-3 pr-3">{key.revokedAt ? "Revoked" : "Active"}</td>
                  <td className="py-3 text-right">
                    {!key.revokedAt && (
                      <button type="button" onClick={() => revokeKey(key)} className="min-h-9 rounded-lg px-3 text-sm font-semibold text-red-400 hover:underline">
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

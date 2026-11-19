"use client";

import { useCallback, useEffect, useState } from "react";

interface PendingInvite {
  id: string;
  invitedEmail: string;
  workspaceName: string;
  expiresAt: string;
}

export function TenantInviteForm() {
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [email, setEmail] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/platform/tenant-invitations", { cache: "no-store" });
      if (!response.ok) return;
      const body = await response.json();
      setInvites(body.data?.invitations ?? []);
    } catch {
      setError("Could not load pending invitations");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInviteUrl(null);
    try {
      const response = await fetch("/api/platform/tenant-invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, workspaceName }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not create invitation");
      setInviteUrl(body.data.inviteUrl);
      setEmail("");
      setWorkspaceName("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create invitation");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    const response = await fetch(`/api/platform/tenant-invitations/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Could not revoke invitation");
      return;
    }
    await load();
  }

  return (
    <section className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-base font-semibold">Invite a partner as workspace owner</h2>
      <p className="mb-4 mt-1 text-sm text-[var(--muted)]">
        The workspace is created when the invitee accepts. The invitee must verify their email first.
        Copy the link and send it yourself; no email is sent.
      </p>
      <form onSubmit={create} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="partner@example.com"
          className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
        />
        <input
          type="text"
          required
          maxLength={120}
          value={workspaceName}
          onChange={(event) => setWorkspaceName(event.target.value)}
          placeholder="Workspace name"
          className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Create invitation
        </button>
      </form>
      {inviteUrl && (
        <p className="mt-3 break-all text-sm">
          Invitation link (shown once, valid 72 hours): <code>{inviteUrl}</code>
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <h3 className="mb-2 mt-6 text-sm font-semibold">Pending invitations</h3>
      {invites.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No pending partner invitations.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] text-sm">
          {invites.map((invite) => (
            <li key={invite.id} className="flex items-center justify-between gap-4 py-3">
              <span>
                <span className="font-medium">{invite.workspaceName}</span>{" "}
                <span className="text-[var(--muted)]">for {invite.invitedEmail}</span>
              </span>
              <button
                type="button"
                onClick={() => void revoke(invite.id)}
                className="text-sm font-semibold text-red-600"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

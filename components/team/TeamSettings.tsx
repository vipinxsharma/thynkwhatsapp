"use client";

import { useState } from "react";
import type { TeamMember, WorkspaceInvitation } from "@/lib/workspaces/team";
import type { AppRole } from "@/lib/auth/token";

export function TeamSettings({
  initialMembers,
  initialInvitations,
  currentRole,
}: {
  initialMembers: TeamMember[];
  initialInvitations: WorkspaceInvitation[];
  currentRole: AppRole;
}) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "agent" | "viewer">("agent");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function createInvite(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setInviteUrl("");
    const response = await fetch("/api/workspaces/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const payload = await response.json();
    if (!response.ok) setError(payload.error || "Unable to create invitation");
    else {
      setInvitations((current) => [payload.data.invitation, ...current.filter((item) => item.invitedEmail !== email.toLowerCase())]);
      setInviteUrl(payload.data.inviteUrl);
      setEmail("");
    }
    setPending(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={createInvite} className="space-y-4 rounded-xl border border-white/10 bg-[#0d1117] p-5">
        <div>
          <h2 className="font-semibold text-white">Invite a teammate</h2>
          <p className="mt-1 text-xs text-gray-400">Links expire after 72 hours and only work for the invited email.</p>
        </div>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="teammate@company.com" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm" />
        <select value={role} onChange={(event) => setRole(event.target.value as typeof role)} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
          {currentRole === "owner" && <option value="admin">Administrator</option>}
          <option value="agent">Agent</option>
          <option value="viewer">Viewer</option>
        </select>
        {error && <p className="text-xs text-red-300">{error}</p>}
        <button disabled={pending} className="rounded-lg bg-whatsapp px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{pending ? "Creating…" : "Create invite link"}</button>
        {inviteUrl && (
          <div className="rounded-lg border border-whatsapp/20 bg-whatsapp/5 p-3">
            <p className="mb-2 text-xs text-gray-300">Share this link with the invited teammate:</p>
            <div className="break-all text-xs text-whatsapp-light">{inviteUrl}</div>
            <button type="button" onClick={() => navigator.clipboard.writeText(inviteUrl)} className="mt-2 text-xs font-semibold text-white">Copy link</button>
          </div>
        )}
      </form>

      <div className="space-y-6">
        <section className="rounded-xl border border-white/10 bg-[#0d1117] p-5">
          <h2 className="font-semibold text-white">Members</h2>
          <div className="mt-4 divide-y divide-white/5">
            {initialMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-4 py-3">
                <div><p className="text-sm text-white">{member.displayName}</p><p className="text-xs text-gray-500">{member.email}</p></div>
                <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase text-gray-300">{member.role}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#0d1117] p-5">
          <h2 className="font-semibold text-white">Pending invitations</h2>
          <div className="mt-4 divide-y divide-white/5">
            {invitations.length === 0 && <p className="text-sm text-gray-400">No pending invitations.</p>}
            {invitations.map((invitation) => (
              <div key={invitation.id} className="flex items-center justify-between gap-4 py-3">
                <p className="text-sm text-gray-300">{invitation.invitedEmail}</p>
                <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase text-gray-300">{invitation.role}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

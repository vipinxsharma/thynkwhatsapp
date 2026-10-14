"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function AcceptInvitation() {
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    setToken(value);
  }, []);

  async function accept() {
    setPending(true);
    setError("");
    const response = await fetch("/api/workspaces/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const payload = await response.json();
    if (response.status === 401) {
      setError("Sign in with the invited email, then open this link again.");
    } else if (!response.ok) setError(payload.error || "Unable to accept this invitation");
    else window.location.assign("/");
    setPending(false);
  }

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-[#0d1117] p-6 text-center">
      <p className="text-sm text-gray-300">Join this Xeccel workspace using the exact email address that was invited.</p>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {!token && <p className="text-sm text-red-300">This invitation link is incomplete.</p>}
      <button onClick={accept} disabled={pending || !token} className="rounded-lg bg-whatsapp px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{pending ? "Accepting…" : "Accept invitation"}</button>
      <div><Link href="/login" className="text-xs text-gray-400 hover:text-white">Sign in or create an account</Link></div>
    </div>
  );
}

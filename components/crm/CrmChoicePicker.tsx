"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { CrmCode, CrmOption } from "@/lib/crm/options";
import type { CrmChoice } from "@/lib/crm/store";

export function CrmChoicePicker({
  options,
  initialChoice,
  canChoose,
  unavailable,
}: {
  options: CrmOption[];
  initialChoice: CrmChoice | null;
  canChoose: boolean;
  unavailable: boolean;
}) {
  const [choice, setChoice] = useState<CrmChoice | null>(initialChoice);
  const [saving, setSaving] = useState<CrmCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const locked = choice?.status === "provisioned";
  const chosen = options.find((option) => option.code === choice?.crmCode);

  async function choose(crmCode: CrmCode) {
    setSaving(crmCode);
    setError(null);
    try {
      const response = await fetch("/api/crm/selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crmCode }),
      });
      const payload = (await response.json().catch(() => null)) as { data?: CrmChoice; error?: string } | null;
      if (payload?.data) setChoice(payload.data);
      if (!response.ok) setError(payload?.error || "CRM choice could not be saved. Please try again.");
    } catch {
      setError("CRM choice could not be saved. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent-text)]">CRM</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--heading)]">Choose your CRM</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
        Your Xeccel plan works with a CRM of your choice. Pick one and sign up for free. You can change your choice until your access is set up.
      </p>

      {unavailable && (
        <p role="alert" className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          Your CRM choice could not be loaded just now. Please refresh the page.
        </p>
      )}
      {!canChoose && (
        <p className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
          Only a workspace owner or admin can choose the CRM.
        </p>
      )}
      {error && <p role="alert" className="mt-6 rounded-xl border border-red-400/40 p-4 text-sm text-red-300">{error}</p>}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {options.map((option) => {
          const selected = choice?.crmCode === option.code;
          return (
            <article
              key={option.code}
              className={`flex flex-col rounded-3xl border bg-[var(--surface)] p-7 ${selected ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-bold text-[var(--heading)]">{option.name}</h2>
                {selected && (
                  <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-bold text-[#0b132a]">Your choice</span>
                )}
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{option.tagline}</p>
              <p className="mt-5 text-sm font-bold text-[var(--heading)]">{option.offer}</p>
              {option.included.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {option.included.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-6">
                      <Check className="mt-1 size-4 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto pt-7">
                {selected ? (
                  option.signupUrl ? (
                    <a
                      href={option.signupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[#0b132a] hover:bg-[var(--accent-hover)]"
                    >
                      Sign up for free
                    </a>
                  ) : (
                    <p className="text-sm leading-6 text-[var(--muted)]">We will email your sign-up details for {option.name}.</p>
                  )
                ) : (
                  <button
                    type="button"
                    disabled={!canChoose || locked || unavailable || saving !== null}
                    aria-busy={saving === option.code}
                    onClick={() => choose(option.code)}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[var(--border)] px-6 py-3 text-sm font-bold text-[var(--heading)] hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving === option.code ? "Saving…" : `Choose ${option.name}`}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {chosen && (
        <p className="mt-6 text-sm text-[var(--muted)]">
          {locked
            ? `Your ${chosen.name} access is set up. Contact support to change your CRM.`
            : `You chose ${chosen.name}. You can switch until your access is set up.`}
        </p>
      )}
    </div>
  );
}

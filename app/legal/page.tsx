import type { Metadata } from "next";
import Link from "next/link";
import { legalContact, policies } from "@/lib/legal/policies";

export const metadata: Metadata = {
  title: "Legal Center | Xeccel",
  description: "Xeccel policies for privacy, payments, cancellations, service delivery, cookies, and responsible messaging.",
  alternates: { canonical: "https://xeccel.com/legal" },
};

export default function LegalCenterPage() {
  return (
    <main id="main-content" className="py-16 md:py-20">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">Xeccel · Legal center</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-[var(--heading)] sm:text-5xl">Clear terms for every conversation and transaction.</h1>
      <p className="mt-6 max-w-3xl text-base leading-8 text-[var(--muted)]">Review how Xeccel handles data, messaging, service delivery, payments, and support. Public paid checkout is not active yet; the terms of any future purchase will be shown before you pay.</p>
      <section aria-label="Xeccel policies" className="mt-12 grid gap-4 sm:grid-cols-2">
        {policies.map((policy, index) => (
          <Link key={policy.slug} href={`/legal/${policy.slug}`} className="group rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7 transition-colors hover:border-[var(--accent)]">
            <span className="text-xs font-bold text-[var(--accent)]">0{index + 1}</span>
            <h2 className="mt-5 text-xl font-semibold text-[var(--heading)]">{policy.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{policy.summary}</p>
            <span className="mt-5 inline-block text-sm font-semibold text-[var(--accent)]">Read policy →</span>
          </Link>
        ))}
      </section>
      <section className="mt-12 rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-7">
        <h2 className="text-xl font-semibold text-[var(--heading)]">Questions or a billing issue?</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Contact {legalContact.entity} at <a href={`mailto:${legalContact.email}`} className="font-semibold text-[var(--accent)] underline underline-offset-4">{legalContact.email}</a> or <a href={`tel:${legalContact.phone.replace(/\D/g, "")}`} className="font-semibold text-[var(--accent)] underline underline-offset-4">{legalContact.phone}</a>. Include your workspace and order reference if relevant; never send a password, card number, CVV, or OTP.</p>
      </section>
    </main>
  );
}

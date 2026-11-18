import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { XeccelLogo } from "@/components/brand/XeccelLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export const metadata: Metadata = {
  title: "Pricing | Xeccel",
  description:
    "Simple, per-number pricing for Xeccel. One workspace for WhatsApp conversations, messaging workflows, and customer support.",
  alternates: { canonical: "https://xeccel.com/pricing" },
};

// Placeholder commercial values. Confirm before publishing.
// The per-number price matches the billing default in lib/billing/config.ts (₹699/month).
const PRICE_PER_NUMBER_INR = 699;

const included = [
  "Shared customer inbox for your whole team",
  "WhatsApp Cloud API connection through Meta",
  "Messaging workflows, templates, and campaigns",
  "AI-assisted support with a path to human review",
  "Team access and workspace controls",
];

const addOns = [
  "Additional WhatsApp numbers, billed per number",
  "Onboarding help from our team",
];

const faqs = [
  {
    question: "How is pricing calculated?",
    answer:
      "You pay per connected WhatsApp number, billed monthly. Taxes and any usage charges from Meta are shown before you pay.",
  },
  {
    question: "Are Meta conversation charges included?",
    answer:
      "No. WhatsApp conversation charges are set by Meta and are billed separately at Meta's current rates for your country and message category.",
  },
  {
    question: "Can I cancel or change my plan?",
    answer:
      "Yes. See our refunds and cancellation policy for how to stop a future renewal or raise an incorrect charge.",
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] py-6">
          <Link href="/" aria-label="Xeccel home">
            <XeccelLogo priority />
          </Link>
          <nav aria-label="Pricing navigation" className="flex items-center gap-5 text-sm font-semibold">
            <Link href="/login">Sign in</Link>
            <Link href="/legal">Policies</Link>
            <ThemeToggle />
          </nav>
        </header>

        <section className="py-16 text-center md:py-20">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent-text)]">Pricing</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight text-[var(--heading)] sm:text-5xl">
            Simple pricing for every customer conversation.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[var(--muted)]">
            Pay per WhatsApp number. Add your team, workflows, and support tools without separate subscriptions.
          </p>
        </section>

        <section aria-label="Plan" className="mx-auto max-w-xl pb-16">
          <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 md:p-10">
            <h2 className="text-xl font-bold text-[var(--heading)]">Xeccel Workspace</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">For teams serving customers on WhatsApp.</p>
            <p className="mt-6 flex items-baseline gap-2">
              <span className="text-5xl font-bold text-[var(--heading)]">₹{PRICE_PER_NUMBER_INR}</span>
              <span className="text-sm font-semibold text-[var(--muted)]">per number / month</span>
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">Plus applicable taxes.</p>

            <ul className="mt-8 space-y-3">
              {included.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-[var(--foreground)]">
                  <Check className="mt-1 size-4 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/getting-started"
              className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[#0b132a] hover:bg-[var(--accent-hover)]"
            >
              Get started
            </Link>
          </article>

          <div className="mt-6 rounded-2xl border border-[var(--border)] p-6">
            <h3 className="text-sm font-bold text-[var(--heading)]">Also included or billed separately</h3>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              {addOns.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="pricing-faq" className="border-t border-[var(--border)] py-16">
          <h2 id="pricing-faq" className="text-2xl font-bold tracking-tight text-[var(--heading)]">Pricing questions</h2>
          <dl className="mt-8 grid gap-6 md:grid-cols-3">
            {faqs.map((faq) => (
              <div key={faq.question} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <dt className="font-bold text-[var(--heading)]">{faq.question}</dt>
                <dd className="mt-3 text-sm leading-7 text-[var(--muted)]">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </main>
  );
}

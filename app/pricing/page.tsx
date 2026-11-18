"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { XeccelLogo } from "@/components/brand/XeccelLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

import { billingPlans } from "@/lib/billing/plans";

// Plan data lives in lib/billing/plans.ts so the price shown here is the price checkout charges.
const plans = billingPlans.map((plan) => ({ ...plan, price: plan.priceInr }));
type Plan = (typeof plans)[number];

// Meta's list rates for India (INR per delivered template message), rounded to two decimals.
// Meta sets and changes these; check the rate card before editing.
const META_PRICING_URL = "https://business.whatsapp.com/products/platform-pricing#rates";
const metaRates = [
  { label: "Authentication", value: "₹0.12" },
  { label: "Utility", value: "₹0.12" },
  { label: "Marketing", value: "₹0.87" },
];

const tabs = [
  { id: "all", label: "All Plans" },
  { id: "annual", label: "Annual Plans" },
  { id: "monthly", label: "Monthly & Trial" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const faqs = [
  {
    question: "Are Meta conversation charges included?",
    answer:
      "No. WhatsApp conversation charges are set by Meta and are billed separately at Meta's current rates for your country and message category.",
  },
  {
    question: "Is GST included?",
    answer: "Prices shown exclude GST. Applicable GST is added at checkout.",
  },
  {
    question: "Can I cancel or change my plan?",
    answer: "Yes. See our refunds and cancellation policy for how to stop a future renewal or raise an incorrect charge.",
  },
];

function visiblePlans(tab: TabId): Plan[] {
  if (tab === "annual") return plans.filter((plan) => plan.term === "Yearly");
  if (tab === "monthly") return plans.filter((plan) => plan.term === "Monthly");
  return plans;
}

export default function PricingPage() {
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const shown = visiblePlans(activeTab);

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

        <section className="py-14 text-center md:py-16">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent-text)]">Official Meta Tech Provider &amp; WhatsApp Automation</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight text-[var(--heading)] sm:text-5xl">
            Simple, Transparent Pricing Built for Growth
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[var(--muted)]">
            Automate customer conversations, run high-converting broadcasts, and scale your sales with WhatsApp tools built for your team.
          </p>

          <div role="tablist" aria-label="Pricing duration filter" className="mx-auto mt-10 inline-flex flex-wrap justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
            {tabs.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                    selected ? "bg-[var(--accent)] text-[#0b132a]" : "text-[var(--muted)] hover:text-[var(--heading)]"
                  }`}
                >
                  {tab.label}
                  {tab.id === "annual" ? <span className="ml-2 text-xs font-bold">Save Big</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section aria-label="Available subscription plans" className="grid gap-6 pb-16 md:grid-cols-2">
          {shown.map((plan) => (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-3xl border bg-[var(--surface)] p-8 ${
                plan.popular ? "border-[var(--accent)]" : "border-[var(--border)]"
              }`}
            >
              {plan.popular ? (
                <span className="absolute right-6 top-0 -translate-y-1/2 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#0b132a]">
                  Most Popular
                </span>
              ) : null}
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">{plan.days}</p>
              <h2 className="mt-3 text-xl font-bold text-[var(--heading)]">{plan.name}</h2>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-bold text-[var(--heading)]">₹{plan.price.toLocaleString("en-IN")}</span>
                <span className="text-sm font-semibold text-[var(--muted)]">/ {plan.period}</span>
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">+ 18% GST applicable</p>

              <h3 className="mt-6 text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Plan capabilities</h3>
              <ul className="mt-4 space-y-3">
                {[plan.description, ...plan.features].map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm leading-6">
                    <Check className="mt-1 size-4 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-8">
                <div className="rounded-2xl border border-dashed border-[var(--border)] p-5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Meta conversation rates</h3>
                  <dl className="mt-3 space-y-2 text-sm">
                    {metaRates.map((rate) => (
                      <div key={rate.label} className="flex items-center justify-between">
                        <dt className="text-[var(--muted)]">{rate.label}</dt>
                        <dd className="font-bold text-[var(--heading)]">{rate.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                    Per message in India, rounded. Charged by Meta and billed separately.{" "}
                    <a className="underline" href={META_PRICING_URL} target="_blank" rel="noopener noreferrer">See Meta&apos;s rate card</a>.
                  </p>
                </div>
              </div>

              <Link
                href="/getting-started"
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[#0b132a] hover:bg-[var(--accent-hover)]"
              >
                Get started
              </Link>
            </article>
          ))}
          {shown.length === 0 ? <p className="text-sm text-[var(--muted)]">No plans in this tab.</p> : null}
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

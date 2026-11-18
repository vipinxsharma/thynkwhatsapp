import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { XeccelLogo } from "@/components/brand/XeccelLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export const metadata: Metadata = {
  title: "Pricing | Xeccel",
  description:
    "Xeccel pricing for WhatsApp conversations, messaging workflows, and customer support. Annual and monthly plans.",
  alternates: { canonical: "https://xeccel.com/pricing" },
};

// Prices in INR, excluding GST. Each figure is the competitor list price plus 25%.
type Plan = {
  id: string;
  term: "Yearly" | "Monthly";
  name: string;
  price: number;
  period: "year" | "month";
  description: string;
  highlight?: boolean;
  features: string[];
};

const plans: Plan[] = [
  {
    id: "sales-accelerator",
    term: "Yearly",
    name: "Sales Accelerator: WhatsApp + CRM",
    price: 20000,
    period: "year",
    description:
      "For teams that want to scale. Includes customer relationship management tools, advanced automation, and deeper insights to close more deals.",
    highlight: true,
    features: [
      "Official WhatsApp Cloud API integration",
      "Multi-agent shared team inbox",
      "CRM tools and advanced automation",
    ],
  },
  {
    id: "lead-automation-suite",
    term: "Yearly",
    name: "Always-On Lead Automation Suite",
    price: 12500,
    period: "year",
    description: "Everything you need to get started with WhatsApp lead automation.",
    features: ["Official WhatsApp Cloud API integration", "Multi-agent shared team inbox"],
  },
  {
    id: "whats-crm-monthly",
    term: "Monthly",
    name: "Whats+CRM Monthly",
    price: 2000,
    period: "month",
    description: "WhatsApp messaging with CRM, billed monthly.",
    features: ["Official WhatsApp Cloud API integration", "Multi-agent shared team inbox", "CRM tools"],
  },
  {
    id: "growth-booster",
    term: "Monthly",
    name: "Growth Booster: WhatsApp Automation",
    price: 1250,
    period: "month",
    description: "A complete monthly solution to manage customers, track payments, and boost engagement.",
    features: ["Official WhatsApp Cloud API integration", "Multi-agent shared team inbox"],
  },
];

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
            Choose an annual or monthly plan. Add your team, workflows, and support tools in one workspace.
          </p>
        </section>

        <section aria-label="Plans" className="grid gap-6 pb-16 md:grid-cols-2">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={`flex flex-col rounded-3xl border bg-[var(--surface)] p-8 ${
                plan.highlight ? "border-[var(--accent)]" : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">{plan.term}</p>
                {plan.highlight ? (
                  <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-bold text-[#0b132a]">Most popular</span>
                ) : null}
              </div>
              <h2 className="mt-3 text-xl font-bold text-[var(--heading)]">{plan.name}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{plan.description}</p>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-bold text-[var(--heading)]">₹{plan.price.toLocaleString("en-IN")}</span>
                <span className="text-sm font-semibold text-[var(--muted)]">/ {plan.period}</span>
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">Plus applicable GST</p>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm leading-6">
                    <Check className="mt-1 size-4 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
                    {feature}
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
          ))}
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

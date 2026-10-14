import type { Metadata } from "next";
import { ArrowDownRight, ArrowUpRight, Bot, MessageSquareText, Workflow } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export const metadata: Metadata = {
  title: "Xeccel | Business messaging, thoughtfully connected",
  description:
    "Xeccel is preparing a self-service workspace for WhatsApp business messaging, customer conversations, and AI-assisted support.",
};

const capabilities = [
  {
    icon: MessageSquareText,
    title: "One place for conversations",
    description: "A shared workspace designed to keep customer messages and team responses together.",
  },
  {
    icon: Workflow,
    title: "Built for self-service",
    description: "Set up messaging workflows and manage day-to-day operations from your own workspace.",
  },
  {
    icon: Bot,
    title: "AI-assisted resolution",
    description: "Planned tools to help resolve routine customer requests across chat and email.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <header className="flex min-h-24 items-center justify-between gap-4 border-b border-[var(--border)]">
          <a href="#top" className="inline-flex items-center gap-3 text-[var(--heading)]" aria-label="Xeccel home">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-xl font-extrabold text-[#0b132a]">X</span>
            <span className="text-xl font-bold tracking-tight">Xeccel</span>
          </a>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs font-medium text-[var(--muted)] sm:inline">A thynkWISE platform</span>
            <ThemeToggle />
          </div>
        </header>

        <section id="top" className="grid gap-12 py-20 md:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)] md:items-end md:py-28">
          <div>
            <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--muted)]">
              <span className="size-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
              Platform in preparation
            </p>
            <h1 className="max-w-4xl text-5xl font-bold leading-[1.08] tracking-tight text-[var(--heading)] sm:text-6xl lg:text-7xl">
              Business messaging, <span className="text-[var(--accent)]">thoughtfully connected.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">
              Xeccel is taking shape as a self-service platform for WhatsApp business messaging, customer conversations, and AI-assisted support. We&apos;re preparing the foundations before opening customer access.
            </p>
            <a href="#capabilities" className="mt-10 inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[#0b132a] transition-colors hover:bg-[var(--accent-hover)]">
              Explore the direction <ArrowDownRight className="size-4" aria-hidden="true" />
            </a>
          </div>
          <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-sm sm:p-9">
            <div className="mb-12 flex items-start justify-between">
              <span className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--muted)]">The approach</span>
              <ArrowUpRight className="size-5 text-[var(--accent)]" aria-hidden="true" />
            </div>
            <p className="text-2xl font-semibold leading-snug tracking-tight text-[var(--heading)]">
              Clear conversations. Useful automation. More control for every team.
            </p>
            <p className="mt-6 text-sm leading-7 text-[var(--muted)]">
              We&apos;ll open access when onboarding, provider connections, and payments are ready for real customers.
            </p>
          </div>
        </section>

        <section id="capabilities" aria-labelledby="capabilities-title" className="border-t border-[var(--border)] py-16 md:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">What we&apos;re building</p>
            <h2 id="capabilities-title" className="mt-4 text-3xl font-bold tracking-tight text-[var(--heading)] sm:text-4xl">One workspace for the customer journey.</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">These capabilities are in development. They are not available for public signup yet.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--accent)]"><Icon className="size-6" aria-hidden="true" /></span>
                <h3 className="mt-8 text-lg font-semibold text-[var(--heading)]">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-[var(--border)] py-8 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Xeccel. A thynkWISE platform.</p>
          <p>Customer access is not open yet.</p>
        </footer>
      </div>
    </main>
  );
}

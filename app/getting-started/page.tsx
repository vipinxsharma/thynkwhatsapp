import type { Metadata } from "next";
import Link from "next/link";
import { XeccelLogo } from "@/components/brand/XeccelLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { workspaceAccessConfigured } from "@/lib/auth/config";
import { customerSetupSteps } from "@/lib/product/customer-journeys";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Get started | Xeccel",
  description: "Your Xeccel setup guide: account access, WhatsApp channels, contacts, messaging activation, inbox, and customer support.",
  alternates: { canonical: "https://xeccel.com/getting-started" },
};

export default function GettingStartedPage() {
  const accessReady = workspaceAccessConfigured();
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] py-6">
          <Link href="/" aria-label="Xeccel home"><XeccelLogo priority /></Link>
          <nav aria-label="Account navigation" className="flex items-center gap-5 text-sm font-semibold">
            <Link href="/login">Sign in</Link><Link href="/legal">Policies</Link><ThemeToggle />
          </nav>
        </header>
        <section className="py-16 md:py-20">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent-text)]">Your Xeccel journey</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-[var(--heading)] sm:text-5xl">From first visit to your customer inbox.</h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-[var(--muted)]">Choose your next step. Account access, channel connection, and live messaging activation are separate milestones, so you know exactly what to do next.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="font-semibold text-[var(--heading)]">New to Xeccel?</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{accessReady ? "Create your account and begin workspace setup." : "Contact our team for help setting up your account. Self-service registration is temporarily unavailable."}</p>
              <a href={accessReady ? "/login?mode=signup" : "mailto:partner@thynkwise.co.in?subject=Xeccel%20account%20setup"} className="mt-5 inline-flex min-h-12 items-center rounded-full bg-[var(--accent)] px-5 text-sm font-bold text-[#0b132a]">{accessReady ? "Create workspace" : "Start assisted setup"}</a>
            </article>
            <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="font-semibold text-[var(--heading)]">Already have an account?</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Sign in to return to your workspace. Your team and customer data remain protected.</p>
              <Link href="/login" className="mt-5 inline-flex min-h-12 items-center font-semibold text-[var(--accent-text)] underline">Sign in →</Link>
              <Link href="/auth/forgot-password" className="block text-xs underline">Forgot password?</Link>
            </article>
            <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="font-semibold text-[var(--heading)]">Need a hand?</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Get help with account access, channel eligibility, messaging activation, or billing questions.</p>
              <a href="mailto:partner@thynkwise.co.in" className="mt-5 inline-flex min-h-12 items-center font-semibold text-[var(--accent-text)] underline">Contact the Xeccel team →</a>
            </article>
          </div>
          <h2 className="mt-16 text-2xl font-bold text-[var(--heading)]">Your setup, step by step</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Workspace links ask you to sign in. After signing in, use the matching section in your workspace navigation.</p>
          <ol className="mt-8 grid gap-4 md:grid-cols-2">
            {customerSetupSteps.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7">
                <span className="text-sm font-bold text-[var(--accent-text)]">0{index + 1}</span>
                <h3 className="mt-4 text-lg font-semibold text-[var(--heading)]">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{step.description}</p>
                <div className="mt-4 flex flex-wrap gap-5 text-sm font-semibold text-[var(--accent-text)]">
                  <a href={index === 0 && !accessReady ? "mailto:partner@thynkwise.co.in?subject=Xeccel%20account%20setup" : step.href} className="inline-flex min-h-11 items-center underline">{index === 0 && !accessReady ? "Contact account support" : step.action} →</a>
                  {step.secondaryHref && <Link href={step.secondaryHref} className="inline-flex min-h-11 items-center underline">{step.secondaryAction} →</Link>}
                </div>
              </li>
            ))}
          </ol>
        </section>
        <footer className="flex flex-wrap justify-between gap-5 border-t border-[var(--border)] py-8 text-xs text-[var(--muted)]">
          <p>Xeccel · Operated by ThynkWISE Advisors Private Limited.</p>
          <Link href="/legal" className="underline">Policies and support details</Link>
        </footer>
      </div>
    </main>
  );
}

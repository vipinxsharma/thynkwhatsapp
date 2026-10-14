import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowDownRight,
  ArrowRight,
  Bot,
  CircleHelp,
  LayoutDashboard,
  MessageSquareText,
  ShieldCheck,
  Smartphone,
  Workflow,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import styles from "./HomePage.module.css";

export const metadata: Metadata = {
  title: "Xeccel | One workspace for business messaging",
  description:
    "Xeccel is building a self-service WhatsApp business platform for service teams: shared conversations, messaging workflows, and AI-assisted customer support.",
  alternates: { canonical: "https://xeccel.com/" },
  openGraph: {
    title: "Xeccel | One workspace for business messaging",
    description:
      "A self-service messaging workspace for service teams. Xeccel is preparing customer access.",
    url: "https://xeccel.com/",
    siteName: "Xeccel",
    type: "website",
  },
  twitter: { card: "summary", title: "Xeccel | Business messaging, in one workspace" },
};

const capabilities = [
  {
    icon: MessageSquareText,
    title: "Shared customer inbox",
    description: "Bring conversations into one team workspace so replies, context, and ownership stay together.",
  },
  {
    icon: Workflow,
    title: "Messaging workflows",
    description: "Prepare templates, campaigns, and follow-ups without juggling disconnected tools.",
  },
  {
    icon: Bot,
    title: "AI-assisted support",
    description: "Help customers resolve routine questions through chat and email, with a path to human review.",
  },
  {
    icon: ShieldCheck,
    title: "Workspace control",
    description: "Keep team access, sender setup, and support activity connected to the right business workspace.",
  },
];

const steps = [
  {
    number: "01",
    title: "Set up your workspace",
    description: "Create a place for your team, conversations, and customer messaging settings.",
  },
  {
    number: "02",
    title: "Connect your channel",
    description: "Complete the provider and business checks required before using a WhatsApp sender.",
  },
  {
    number: "03",
    title: "Serve customers together",
    description: "Use the inbox and workflows to manage responses, follow-ups, and support as one team.",
  },
];

const questions = [
  {
    question: "Can I create a Xeccel account today?",
    answer:
      "Not yet. The website is live, but public customer onboarding remains closed while provider connections, payments, and launch checks are completed.",
  },
  {
    question: "Will Xeccel work with my WhatsApp business number?",
    answer:
      "That depends on the number's current provider and Meta account status. The planned onboarding flow will check ownership and eligibility before a number is connected.",
  },
  {
    question: "Is SMS part of the platform?",
    answer:
      "SMS is planned for a later phase. It will have a separate operator and DLT setup process; WhatsApp onboarding will not automatically enable SMS.",
  },
];

export default function HomePage() {
  return (
    <main id="top" className={`${styles.home} min-h-screen bg-[var(--background)] text-[var(--foreground)]`}>
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-4 focus:rounded-full focus:bg-[var(--surface)] focus:px-4 focus:py-3">Skip to content</a>
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <header className="flex min-h-24 flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] py-4">
          <a href="#top" className="inline-flex items-center gap-3 text-[var(--heading)]" aria-label="Xeccel home">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-xl font-extrabold text-[#0b132a]">X</span>
            <span className="text-xl font-bold tracking-tight">Xeccel</span>
          </a>
          <nav aria-label="Main navigation" className="order-3 flex w-full flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-[var(--muted)] md:order-2 md:w-auto">
            <a className="hover:text-[var(--heading)]" href="#platform">Platform</a>
            <a className="hover:text-[var(--heading)]" href="#how-it-works">How it works</a>
            <a className="hover:text-[var(--heading)]" href="#roadmap">Roadmap</a>
            <a className="hover:text-[var(--heading)]" href="#questions">Questions</a>
          </nav>
          <div className="order-2 flex items-center gap-3 md:order-3">
            <a href="https://www.thynkwise.ai/" className={`${styles.poweredUnit} hidden items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-3 py-1.5 lg:inline-flex`} aria-label="Powered by thynkWISE">
              <span className="w-10 text-[9px] font-semibold uppercase leading-tight tracking-wide text-[#142142]">Powered by</span>
              <Image src="/brand/thynkwise-logo.png" alt="thynkWISE" width={100} height={38} className="h-auto w-[100px]" />
            </a>
            <ThemeToggle />
          </div>
        </header>

        <div id="content">
          <section className={`${styles.hero} grid gap-12 py-20 md:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)] md:items-center md:py-28`}>
            <div>
              <p className={`${styles.intro} mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--muted)]`}>
                <span className="size-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                Xeccel is preparing for launch
              </p>
              <h1 className={`${styles.headline} max-w-4xl text-5xl font-bold leading-[1.08] tracking-tight text-[var(--heading)] sm:text-6xl lg:text-7xl`}>
                One workspace for <span className={styles.headlineAccent}>every customer conversation.</span>
              </h1>
              <p className={`${styles.subhead} mt-8 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg`}>
                We&apos;re building Xeccel for service teams that want to manage WhatsApp conversations, messaging workflows, and customer support themselves — without stitching together separate tools.
              </p>
              <div className={`${styles.actions} mt-10 flex flex-wrap items-center gap-4`}>
                <a href="#platform" className={`${styles.primaryLink} inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[#0b132a] hover:bg-[var(--accent-hover)]`}>
                  Explore the platform <ArrowDownRight className="size-4" aria-hidden="true" />
                </a>
                <a href="#roadmap" className={`${styles.secondaryLink} inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-sm font-semibold text-[var(--heading)] hover:border-[var(--accent)]`}>
                  See launch status <ArrowRight className="size-4" aria-hidden="true" />
                </a>
              </div>
            </div>
            <div className={`${styles.visual} rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm sm:p-4`}>
              <div className={styles.mediaFrame}>
                <Image
                  src="/media/xeccel-flow-hero.webp"
                  alt="Abstract orange light trails linking translucent conversation cards"
                  width={1376}
                  height={768}
                  priority
                  sizes="(max-width: 768px) 100vw, 40vw"
                  className="h-auto w-full"
                />
                <span className={styles.mediaLabel}>The Xeccel idea, in motion</span>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-5">
                <span className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--muted)]">One connected workspace</span>
                <LayoutDashboard className="size-5 text-[var(--accent)]" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-3 gap-2 px-3 pb-3">
                {["Conversations", "Workflows", "Support"].map((item, index) => (
                  <div key={item} className="rounded-xl bg-[var(--surface-muted)] px-2 py-3 text-center">
                    <span className="block text-xs font-bold text-[var(--accent)]">0{index + 1}</span>
                    <span className="mt-1 block text-[10px] font-semibold text-[var(--heading)] sm:text-xs">{item}</span>
                  </div>
                ))}
              </div>
              <p className="px-3 pb-3 text-xs leading-5 text-[var(--muted)]">Concept illustration, not a product screenshot. Customer access is not open yet.</p>
            </div>
          </section>

          <div className={styles.ticker} aria-hidden="true">
            <div className={styles.tickerTrack}>
              <span className={styles.tickerText}>ONE INBOX ✦ LESS CHAOS ✦ MORE MOMENTUM ✦ BUILT FOR SERVICE TEAMS ✦ </span>
              <span className={styles.tickerText}>ONE INBOX ✦ LESS CHAOS ✦ MORE MOMENTUM ✦ BUILT FOR SERVICE TEAMS ✦ </span>
            </div>
          </div>

          <section id="platform" aria-labelledby="platform-title" className={`${styles.scrollReveal} scroll-mt-8 border-t border-[var(--border)] py-16 md:py-20`}>
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">Designed for service teams</p>
              <h2 id="platform-title" className="mt-4 text-3xl font-bold tracking-tight text-[var(--heading)] sm:text-4xl">Keep the conversation and the work around it together.</h2>
              <p className="mt-5 text-sm leading-7 text-[var(--muted)]">A customer question should not get lost between a phone, a campaign tool, and a support inbox. Xeccel is being built to give your team one place to see what happened and decide what comes next.</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {capabilities.map(({ icon: Icon, title, description }) => (
                <article key={title} className={`${styles.card} rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7`}>
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--accent)]"><Icon className="size-6" aria-hidden="true" /></span>
                  <h3 className="mt-7 text-lg font-semibold text-[var(--heading)]">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{description}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="how-it-works" aria-labelledby="how-title" className={`${styles.scrollReveal} scroll-mt-8 border-t border-[var(--border)] py-16 md:py-20`}>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">Planned self-service journey</p>
                <h2 id="how-title" className="mt-4 text-3xl font-bold tracking-tight text-[var(--heading)] sm:text-4xl">Set up, connect, and serve — from one place.</h2>
              </div>
              <p className="max-w-sm text-sm leading-7 text-[var(--muted)]">The flow below is our launch direction, not an active signup promise.</p>
            </div>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {steps.map((step) => (
                <li key={step.number} className={`${styles.card} rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7`}>
                  <span className="text-sm font-bold text-[var(--accent)]">{step.number}</span>
                  <h3 className="mt-8 text-lg font-semibold text-[var(--heading)]">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{step.description}</p>
                </li>
              ))}
            </ol>
          </section>

          <section id="roadmap" aria-labelledby="roadmap-title" className={`${styles.scrollReveal} scroll-mt-8 border-t border-[var(--border)] py-16 md:py-20`}>
            <div className="grid gap-10 rounded-[2rem] bg-[#142142] p-8 text-white md:grid-cols-[1fr_1.1fr] md:p-12">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f38b26]">Launch status</p>
                <h2 id="roadmap-title" className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">We&apos;re opening carefully, not prematurely.</h2>
                <p className="mt-5 text-sm leading-7 text-slate-200">The public website is ready. Customer onboarding will open after the provider, account, and payment checks needed for reliable service are complete.</p>
              </div>
              <div className="space-y-3">
                <div className="flex gap-4 rounded-2xl border border-white/15 bg-white/5 p-5">
                  <MessageSquareText className="mt-1 size-5 shrink-0 text-[#f38b26]" aria-hidden="true" />
                  <div><h3 className="font-semibold">WhatsApp platform</h3><p className="mt-1 text-xs leading-6 text-slate-200">Core workspace and integration work is in progress. Public onboarding is not open.</p></div>
                </div>
                <div className="flex gap-4 rounded-2xl border border-white/15 bg-white/5 p-5">
                  <CircleHelp className="mt-1 size-5 shrink-0 text-[#f38b26]" aria-hidden="true" />
                  <div><h3 className="font-semibold">AI support</h3><p className="mt-1 text-xs leading-6 text-slate-200">Chat and email resolution are part of the product plan, with safety checks and human handoff.</p></div>
                </div>
                <div className="flex gap-4 rounded-2xl border border-white/15 bg-white/5 p-5">
                  <Smartphone className="mt-1 size-5 shrink-0 text-[#f38b26]" aria-hidden="true" />
                  <div><h3 className="font-semibold">SMS gateway · Phase 2</h3><p className="mt-1 text-xs leading-6 text-slate-200">A separate future channel with its own operator selection and DLT process.</p></div>
                </div>
              </div>
            </div>
          </section>

          <section id="questions" aria-labelledby="questions-title" className={`${styles.scrollReveal} scroll-mt-8 border-t border-[var(--border)] py-16 md:py-20`}>
            <div className="grid gap-10 md:grid-cols-[.8fr_1.2fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">Good to know</p>
                <h2 id="questions-title" className="mt-4 text-3xl font-bold tracking-tight text-[var(--heading)] sm:text-4xl">Questions before launch?</h2>
              </div>
              <div className="space-y-3">
                {questions.map(({ question, answer }) => (
                  <details key={question} className={`${styles.question} group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5`}>
                    <summary className="relative cursor-pointer list-none pr-6 text-sm font-semibold text-[var(--heading)] marker:hidden">{question}</summary>
                    <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          <section className={`${styles.scrollReveal} mb-16 rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-8 md:p-12`}>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">Xeccel is on its way</p>
            <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-[var(--heading)] sm:text-4xl">A better home for your customer messaging is taking shape.</h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--muted)]">For now, explore the platform direction and check back as we complete the launch gates. We won&apos;t ask you to sign up for a service that is not ready.</p>
            <a href="#platform" className={`${styles.primaryLink} mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[#0b132a] hover:bg-[var(--accent-hover)]`}>Explore what&apos;s coming <ArrowRight className="size-4" aria-hidden="true" /></a>
          </section>
        </div>

        <footer className="flex flex-col gap-5 border-t border-[var(--border)] py-8 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-5">
            <p>© {new Date().getFullYear()} Xeccel.</p>
            <a href="https://www.thynkwise.ai/" className={`${styles.poweredUnit} inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-3 py-1.5`} aria-label="Powered by thynkWISE">
              <span className="w-10 text-[9px] font-semibold uppercase leading-tight tracking-wide text-[#142142]">Powered by</span>
              <Image src="/brand/thynkwise-logo.png" alt="thynkWISE" width={100} height={38} className="h-auto w-[100px]" />
            </a>
          </div>
          <p>Public website live · Customer access in preparation</p>
        </footer>
      </div>
    </main>
  );
}

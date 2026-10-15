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
import { XeccelLogo } from "@/components/brand/XeccelLogo";
import styles from "./HomePage.module.css";

export const metadata: Metadata = {
  title: "Xeccel | One workspace for business messaging",
  description:
    "Manage customer conversations, prepare messaging workflows, and get support with Xeccel. Explore the platform and start your workspace setup.",
  alternates: { canonical: "https://xeccel.com/" },
  openGraph: {
    title: "Xeccel | One workspace for business messaging",
    description:
      "One workspace for your customer conversations. Explore Xeccel and start your setup.",
    url: "https://xeccel.com/",
    siteName: "Xeccel",
    type: "website",
    images: [{ url: "/brand/xeccel-logo-horizontal.png", width: 1200, height: 600, alt: "Xeccel logo" }],
  },
  twitter: { card: "summary_large_image", title: "Xeccel | Business messaging, in one workspace", images: ["/brand/xeccel-logo-horizontal.png"] },
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
      "Use Get started to create your workspace when self-service access is available, or contact our onboarding team for setup assistance. WhatsApp messaging requires a verified channel and an enabled messaging plan.",
  },
  {
    question: "Will Xeccel work with my WhatsApp business number?",
    answer:
      "Eligibility depends on your number’s current provider and Meta account status. An owner or admin connects a number through Channels, then completes the required Meta checks.",
  },
  {
    question: "Is SMS part of the platform?",
    answer:
      "SMS is planned for a later phase. It will have a separate operator and DLT setup process; WhatsApp onboarding will not automatically enable SMS.",
  },
];

const policyHighlights = [
  { title: "Privacy & data", detail: "See what Xeccel handles and how to request access, correction, or deletion.", href: "/legal/privacy" },
  { title: "Payments & terms", detail: "Understand how plan prices, taxes, billing periods, and renewals will be disclosed.", href: "/legal/terms" },
  { title: "Refunds & cancellation", detail: "Know how to stop a future renewal or raise an incorrect or duplicate charge.", href: "/legal/refunds-cancellations" },
  { title: "Service delivery", detail: "See the difference between workspace access and provider-approved live messaging.", href: "/legal/service-delivery" },
];

export default function HomePage() {
  return (
    <main id="top" className={`${styles.home} min-h-screen bg-[var(--background)] text-[var(--foreground)]`}>
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-4 focus:rounded-full focus:bg-[var(--surface)] focus:px-4 focus:py-3">Skip to content</a>
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <header className="flex min-h-24 flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] py-4">
          <a href="#top" className="inline-flex items-center gap-3 text-[var(--heading)]" aria-label="Xeccel home">
            <XeccelLogo priority />
          </a>
          <nav aria-label="Main navigation" className="order-3 flex w-full flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-[var(--muted)] md:order-2 md:w-auto">
            <a className="hover:text-[var(--heading)]" href="#platform">Platform</a>
            <a className="hover:text-[var(--heading)]" href="#how-it-works">How it works</a>
            <a className="hover:text-[var(--heading)]" href="#customer-journeys">Customer journeys</a>
            <a className="hover:text-[var(--heading)]" href="#questions">Questions</a>
            <a className="hover:text-[var(--heading)]" href="#policies">Policies</a>
          </nav>
          <div className="order-2 flex items-center gap-3 md:order-3">
            <a href="/login" className="text-sm font-semibold text-[var(--heading)]">Sign in</a>
            <a href="/getting-started" className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[#0b132a]">Get started</a>
            <ThemeToggle />
          </div>
        </header>

        <div id="content">
          <section className={`${styles.hero} grid gap-12 py-20 md:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)] md:items-center md:py-28`}>
            <div>
              <p className={`${styles.intro} mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--muted)]`}>
                <span className="size-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                Business messaging, made simple
              </p>
              <h1 className={`${styles.headline} max-w-4xl text-5xl font-bold leading-[1.08] tracking-tight text-[var(--heading)] sm:text-6xl lg:text-7xl`}>
                One workspace for <span className={styles.headlineAccent}>every customer conversation.</span>
              </h1>
              <p className={`${styles.subhead} mt-8 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg`}>
                Xeccel brings service teams a workspace to manage WhatsApp conversations, messaging workflows, and customer support themselves — without stitching together separate tools.
              </p>
              <p className="mt-3 text-sm font-medium text-[var(--muted)]">Xeccel is pronounced like “Excel.”</p>
              <div className={`${styles.actions} mt-10 flex flex-wrap items-center gap-4`}>
                <a href="/getting-started" className={`${styles.primaryLink} inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[#0b132a] hover:bg-[var(--accent-hover)]`}>
                  Get started <ArrowDownRight className="size-4" aria-hidden="true" />
                </a>
                <a href="#customer-journeys" className={`${styles.secondaryLink} inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-sm font-semibold text-[var(--heading)] hover:border-[var(--accent)]`}>
                  Find your next step <ArrowRight className="size-4" aria-hidden="true" />
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
              </div>
              <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-5">
                <span className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--muted)]">One connected workspace</span>
                <LayoutDashboard className="size-5 text-[var(--accent-text)]" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-3 gap-2 px-3 pb-3">
                {["Conversations", "Workflows", "Support"].map((item, index) => (
                  <div key={item} className="rounded-xl bg-[var(--surface-muted)] px-2 py-3 text-center">
                    <span className="block text-xs font-bold text-[var(--accent-text)]">0{index + 1}</span>
                    <span className="mt-1 block text-[10px] font-semibold text-[var(--heading)] sm:text-xs">{item}</span>
                  </div>
                ))}
              </div>
              <p className="px-3 pb-3 text-xs leading-5 text-[var(--muted)]">Brand illustration. Explore your account setup and customer journey below.</p>
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
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent-text)]">Designed for service teams</p>
              <h2 id="platform-title" className="mt-4 text-3xl font-bold tracking-tight text-[var(--heading)] sm:text-4xl">Keep the conversation and the work around it together.</h2>
              <p className="mt-5 text-sm leading-7 text-[var(--muted)]">A customer question should not get lost between a phone, a campaign tool, and a support inbox. Xeccel gives your team a workspace to see what happened and decide what comes next.</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {capabilities.map(({ icon: Icon, title, description }) => (
                <article key={title} className={`${styles.card} rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7`}>
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--accent-text)]"><Icon className="size-6" aria-hidden="true" /></span>
                  <h3 className="mt-7 text-lg font-semibold text-[var(--heading)]">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{description}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="vision-film" aria-labelledby="vision-film-title" className={`${styles.scrollReveal} border-t border-[var(--border)] py-16 md:py-20`}>
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent-text)]">The Xeccel experience</p>
              <h2 id="vision-film-title" className="mt-4 text-3xl font-bold tracking-tight text-[var(--heading)] sm:text-4xl">Meet Xeccel in motion.</h2>
              <p className="mt-5 text-sm leading-7 text-[var(--muted)]">A voiced introduction and two silent films explore connected conversations, workflows, and AI-assisted support. These are creative illustrations, not footage of a live customer account.</p>
            </div>
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <article className={`${styles.filmFrame} lg:col-span-2`}>
                <div className="grid lg:grid-cols-[.36fr_.64fr] lg:items-center">
                  <div className="p-6 sm:p-8">
                    <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent-text)]">With voice</p>
                    <h3 className="mt-3 text-2xl font-bold text-[var(--heading)]">The Xeccel introduction</h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">A fictional presenter introduces Xeccel against a modern service-team backdrop. Play to hear the English narration. The brand name is pronounced like “Excel.”</p>
                    <details className={`${styles.transcript} mt-5 text-xs leading-6 text-[var(--muted)]`}>
                      <summary className="cursor-pointer font-semibold text-[var(--heading)]">Read the transcript</summary>
                      <p className="mt-2">Every customer message matters. Xeccel is designed to give service teams one place for conversations, workflows, and AI-assisted support. Our goal is simple: make it easier to stay in the loop and resolve routine questions faster. Built for teams that want every conversation to move forward. Xeccel, powered by thynkWISE. Explore Xeccel at xeccel.com. One connected place for your service team.</p>
                    </details>
                  </div>
                  <video controls playsInline preload="none" poster="/media/xeccel-presenter-poster.jpg" aria-label="Xeccel introduction with a fictional presenter and English narration">
                    <source src="/media/xeccel-heygen-presenter-corrected.mp4" type="video/mp4" />
                    Your browser does not support video playback.
                  </video>
                </div>
              </article>
              <figure className={styles.filmFrame}>
                <video controls playsInline preload="none" poster="/media/xeccel-video-poster.jpg" aria-label="Silent Xeccel service conversation film">
                  <source src="/media/xeccel-heygen-explainer-silent.mp4" type="video/mp4" />
                  Your browser does not support video playback.
                </video>
                <figcaption className="px-5 py-4 text-xs leading-6 text-[var(--muted)]"><strong className="text-[var(--heading)]">The experience · Silent, 20 seconds.</strong> Concept animation, not footage of a live product.</figcaption>
              </figure>
              <figure className={styles.filmFrame}>
                <video controls playsInline muted preload="none" poster="/media/xeccel-flow-hero.webp" aria-label="Silent Google Flow Xeccel motion concept">
                  <source src="/media/xeccel-google-flow-loop.mp4" type="video/mp4" />
                  Your browser does not support video playback.
                </video>
                <figcaption className="px-5 py-4 text-xs leading-6 text-[var(--muted)]"><strong className="text-[var(--heading)]">The energy · Silent, 8 seconds.</strong> A Google Flow concept loop inspired by the Xeccel visual identity.</figcaption>
              </figure>
            </div>
            <p className="mt-5 text-xs leading-6 text-[var(--muted)]">Brand films illustrate the Xeccel experience. Visit Get started for account setup and channel requirements.</p>
          </section>

          <section id="how-it-works" aria-labelledby="how-title" className={`${styles.scrollReveal} scroll-mt-8 border-t border-[var(--border)] py-16 md:py-20`}>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent-text)]">Your setup journey</p>
                <h2 id="how-title" className="mt-4 text-3xl font-bold tracking-tight text-[var(--heading)] sm:text-4xl">Set up, connect, and serve — from one place.</h2>
              </div>
              <p className="max-w-sm text-sm leading-7 text-[var(--muted)]">Start with your workspace, connect an eligible WhatsApp number, then complete messaging activation with our team.</p>
            </div>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {steps.map((step) => (
                <li key={step.number} className={`${styles.card} rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7`}>
                  <span className="text-sm font-bold text-[var(--accent-text)]">{step.number}</span>
                  <h3 className="mt-8 text-lg font-semibold text-[var(--heading)]">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{step.description}</p>
                </li>
              ))}
            </ol>
          </section>

          <section id="customer-journeys" aria-labelledby="journeys-title" className={`${styles.scrollReveal} scroll-mt-8 border-t border-[var(--border)] py-16 md:py-20`}>
            <div className="grid gap-10 rounded-[2rem] bg-[#142142] p-8 text-white md:grid-cols-[1fr_1.1fr] md:p-12">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f38b26]">Customer journeys</p>
                <h2 id="journeys-title" className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">A clear next step for every customer.</h2>
                <p className="mt-5 text-sm leading-7 text-slate-200">New to Xeccel? Start your account setup. Returning customer? Sign in to your workspace. Need help? Contact support or follow the setup guide.</p>
              </div>
              <div className="space-y-3">
                <div className="flex gap-4 rounded-2xl border border-white/15 bg-white/5 p-5">
                  <MessageSquareText className="mt-1 size-5 shrink-0 text-[#f38b26]" aria-hidden="true" />
                  <div><h3 className="font-semibold">New customers</h3><p className="mt-1 text-xs leading-6 text-slate-200">Set up your account, connect your channel, and prepare your team.</p><a href="/getting-started" className="mt-2 inline-block text-sm font-semibold text-[#f38b26] underline">Start your setup →</a></div>
                </div>
                <div className="flex gap-4 rounded-2xl border border-white/15 bg-white/5 p-5">
                  <CircleHelp className="mt-1 size-5 shrink-0 text-[#f38b26]" aria-hidden="true" />
                  <div><h3 className="font-semibold">Returning customers</h3><p className="mt-1 text-xs leading-6 text-slate-200">Sign in to your workspace or recover your account.</p><a href="/login" className="mt-2 inline-block text-sm font-semibold text-[#f38b26] underline">Sign in →</a> <a href="/auth/forgot-password" className="ml-3 text-xs underline">Reset password</a></div>
                </div>
                <div className="flex gap-4 rounded-2xl border border-white/15 bg-white/5 p-5">
                  <Smartphone className="mt-1 size-5 shrink-0 text-[#f38b26]" aria-hidden="true" />
                  <div><h3 className="font-semibold">Setup and customer support</h3><p className="mt-1 text-xs leading-6 text-slate-200">Get help with account access, channel setup, or a service question.</p><a href="mailto:partner@thynkwise.co.in" className="mt-2 inline-block text-sm font-semibold text-[#f38b26] underline">Contact the Xeccel team →</a></div>
                </div>
              </div>
            </div>
          </section>

          <section id="questions" aria-labelledby="questions-title" className={`${styles.scrollReveal} scroll-mt-8 border-t border-[var(--border)] py-16 md:py-20`}>
            <div className="grid gap-10 md:grid-cols-[.8fr_1.2fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent-text)]">Good to know</p>
                <h2 id="questions-title" className="mt-4 text-3xl font-bold tracking-tight text-[var(--heading)] sm:text-4xl">Questions before you get started?</h2>
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

          <section id="policies" aria-labelledby="policies-title" className={`${styles.scrollReveal} scroll-mt-8 border-t border-[var(--border)] py-16 md:py-20`}>
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent-text)]">Clear before you commit</p>
              <h2 id="policies-title" className="mt-4 text-3xl font-bold tracking-tight text-[var(--heading)] sm:text-4xl">Your data, payments, and service terms — in plain sight.</h2>
              <p className="mt-5 text-sm leading-7 text-[var(--muted)]">Review our policies before you get started. Account setup and paid messaging activation are separate steps. Any plan price, billing period, taxes, and usage charges must be confirmed before you pay.</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {policyHighlights.map((item) => (
                <a key={item.href} href={item.href} className={`${styles.card} rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7 hover:border-[var(--accent)]`}>
                  <h3 className="text-lg font-semibold text-[var(--heading)]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{item.detail}</p>
                  <span className="mt-5 inline-block text-sm font-semibold text-[var(--accent-text)]">Read the policy →</span>
                </a>
              ))}
            </div>
            <a href="/legal" className="mt-7 inline-flex text-sm font-semibold text-[var(--accent-text)] underline underline-offset-4">View all policies and support details</a>
          </section>

          <section className={`${styles.scrollReveal} mb-16 rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-8 md:p-12`}>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent-text)]">Make your next conversation count</p>
            <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-[var(--heading)] sm:text-4xl">Bring your customer conversations together.</h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--muted)]">Follow the setup guide, access your workspace, or ask our team to help you connect your business.</p>
            <a href="/getting-started" className={`${styles.primaryLink} mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[#0b132a] hover:bg-[var(--accent-hover)]`}>Get started with Xeccel <ArrowRight className="size-4" aria-hidden="true" /></a>
          </section>
        </div>

        <footer className="grid gap-8 border-t border-[var(--border)] py-10 text-xs text-[var(--muted)] md:grid-cols-[1fr_1.5fr]">
          <div className="space-y-4">
            <p>© {new Date().getFullYear()} Xeccel · Operated by ThynkWISE Advisors Private Limited.</p>
            <XeccelLogo size="footer" />
            <p>Customer setup · Workspace access · Support</p>
          </div>
          <nav aria-label="Policies and support" className="grid gap-x-5 gap-y-3 sm:grid-cols-3">
            <a href="/legal/privacy" className="hover:text-[var(--heading)]">Privacy Policy</a>
            <a href="/legal/terms" className="hover:text-[var(--heading)]">Terms of Service</a>
            <a href="/legal/refunds-cancellations" className="hover:text-[var(--heading)]">Refunds & Cancellations</a>
            <a href="/legal/service-delivery" className="hover:text-[var(--heading)]">Service Delivery</a>
            <a href="/legal/cookies" className="hover:text-[var(--heading)]">Cookie Policy</a>
            <a href="/legal/messaging-use" className="hover:text-[var(--heading)]">Messaging Use</a>
            <a href="/legal" className="font-semibold text-[var(--accent-text)] hover:underline">Legal & Support Center</a>
            <a href="mailto:partner@thynkwise.co.in" className="hover:text-[var(--heading)]">Contact support</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}

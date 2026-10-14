import Link from "next/link";
import type { ReactNode } from "react";

export type Capability = {
  title: string;
  description: string;
  status: "Available foundation" | "Planned" | "Phase 2";
  href?: string;
  linkLabel?: string;
};

export function CapabilitySection({
  eyebrow,
  title,
  description,
  notice,
  capabilities,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  notice: string;
  capabilities: Capability[];
  children?: ReactNode;
}) {
  return (
    <main className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-7">
        <header className="space-y-3 border-b border-[var(--border)] pb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-whatsapp-dark">{eyebrow}</p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--heading)]">{title}</h1>
          <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">{description}</p>
        </header>

        <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-[var(--foreground)]">
          {notice}
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {capabilities.map((capability) => (
            <section key={capability.title} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-lg font-semibold text-[var(--heading)]">{capability.title}</h2>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
                  {capability.status}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{capability.description}</p>
              {capability.href && (
                <Link href={capability.href} className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-whatsapp-dark hover:underline">
                  {capability.linkLabel || "Open section"} →
                </Link>
              )}
            </section>
          ))}
        </div>
        {children}
      </div>
    </main>
  );
}

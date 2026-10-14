import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { legalContact, policies } from "@/lib/legal/policies";

export default function LegalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-4 focus:rounded-full focus:bg-[var(--surface)] focus:px-4 focus:py-3">Skip to content</a>
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <header className="flex min-h-24 flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] py-4">
          <Link href="/" className="inline-flex items-center gap-3 text-[var(--heading)]" aria-label="Xeccel home">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-xl font-extrabold text-[#0b132a]">X</span>
            <span className="text-xl font-bold tracking-tight">Xeccel</span>
          </Link>
          <nav aria-label="Legal navigation" className="flex items-center gap-4 text-sm font-medium text-[var(--muted)]">
            <Link href="/legal" className="hover:text-[var(--heading)]">Legal center</Link>
            <Link href="/" className="hover:text-[var(--heading)]">Home</Link>
            <ThemeToggle />
          </nav>
        </header>
        {children}
        <footer className="grid gap-8 border-t border-[var(--border)] py-10 text-sm text-[var(--muted)] md:grid-cols-[1fr_2fr]">
          <div>
            <p className="font-semibold text-[var(--heading)]">Xeccel</p>
            <p className="mt-2">Operated by {legalContact.entity}</p>
            <a href={`mailto:${legalContact.email}`} className="mt-3 block hover:text-[var(--heading)]">{legalContact.email}</a>
            <a href={`tel:${legalContact.phone.replace(/\D/g, "")}`} className="mt-1 block hover:text-[var(--heading)]">{legalContact.phone}</a>
            <p className="mt-3 text-xs leading-5">{legalContact.address}</p>
          </div>
          <div>
            <p className="font-semibold text-[var(--heading)]">Policies</p>
            <nav aria-label="All Xeccel policies" className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {policies.map((policy) => <Link key={policy.slug} href={`/legal/${policy.slug}`} className="hover:text-[var(--heading)]">{policy.title}</Link>)}
            </nav>
            <a href="https://www.thynkwise.ai/" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-1.5" aria-label="Powered by thynkWISE">
              <span className="w-10 text-[9px] font-semibold uppercase leading-tight text-[#142142]">Powered by</span>
              <Image src="/brand/thynkwise-logo.png" alt="thynkWISE" width={100} height={38} className="h-auto w-[100px]" />
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

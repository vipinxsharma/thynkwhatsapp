import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPolicy, legalContact, policies } from "@/lib/legal/policies";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return policies.map((policy) => ({ slug: policy.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const policy = getPolicy(slug);
  if (!policy) return { title: "Policy not found | Xeccel" };
  return {
    title: `${policy.title} | Xeccel`,
    description: policy.summary,
    alternates: { canonical: `https://xeccel.com/legal/${policy.slug}` },
  };
}

export default async function PolicyPage({ params }: Props) {
  const { slug } = await params;
  const policy = getPolicy(slug);
  if (!policy) notFound();

  return (
    <main id="main-content" className="py-14 md:py-20">
      <Link href="/legal" className="text-sm font-semibold text-[var(--accent)] hover:underline">← All Xeccel policies</Link>
      <p className="mt-10 text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">Xeccel · Legal</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-[var(--heading)] sm:text-5xl">{policy.title}</h1>
      <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted)]">{policy.summary}</p>
      <p className="mt-4 text-xs text-[var(--muted)]">Last updated 15 October 2026 · Applies to xeccel.com and Xeccel services</p>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <article className="space-y-6">
          {policy.sections.map((section) => (
            <section key={section.heading} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-[var(--heading)]">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4 text-sm leading-7 text-[var(--muted)]">{paragraph}</p>)}
              {section.bullets && <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-[var(--muted)]">{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
            </section>
          ))}
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-[var(--heading)]">Contact and questions</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">Email <a href={`mailto:${legalContact.email}`} className="font-semibold text-[var(--accent)] underline underline-offset-4">{legalContact.email}</a> for a policy, payment, or account question. We may ask for a workspace or order reference to help locate the issue. Do not include credentials or full payment-card details.</p>
          </section>
        </article>
        <aside className="h-fit rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 lg:sticky lg:top-6">
          <h2 className="text-sm font-semibold text-[var(--heading)]">More Xeccel policies</h2>
          <nav aria-label="Related policies" className="mt-4 flex flex-col gap-3 text-sm text-[var(--muted)]">
            {policies.filter((item) => item.slug !== policy.slug).map((item) => <Link key={item.slug} href={`/legal/${item.slug}`} className="hover:text-[var(--accent)]">{item.title}</Link>)}
          </nav>
        </aside>
      </div>
    </main>
  );
}

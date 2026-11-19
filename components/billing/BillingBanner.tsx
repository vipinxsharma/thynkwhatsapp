import Link from "next/link";

export function BillingBanner() {
  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10 px-6 py-3 text-sm">
      <span className="font-medium">This workspace has no active plan yet.</span>{" "}
      <span className="text-[var(--muted)]">Choose a plan to keep WhatsApp sending and automation running.</span>{" "}
      <Link href="/billing" className="font-semibold underline">Choose a plan</Link>
    </div>
  );
}

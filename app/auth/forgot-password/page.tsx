import Link from "next/link";
import { requestPasswordResetAction } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-6">
      <form action={requestPasswordResetAction} className="w-full max-w-md space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <div className="flex justify-end"><ThemeToggle /></div>
        <h1 className="text-xl font-bold text-[var(--heading)]">Reset your password</h1>
        <p className="text-xs text-[var(--muted)]">We will email instructions if the account exists.</p>
        <input name="email" type="email" required placeholder="Email" aria-label="Email" className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm" />
        <button className="min-h-12 w-full rounded-full bg-whatsapp px-4 py-2.5 text-sm font-semibold text-[#0b132a] shadow-glow hover:bg-whatsapp-dark">Send reset instructions</button>
        <Link href="/login" className="block text-center text-xs text-[var(--muted)] hover:text-[var(--heading)]">Back to sign in</Link>
      </form>
    </main>
  );
}

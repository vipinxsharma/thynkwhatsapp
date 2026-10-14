import { resetPasswordAction } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { XeccelLogo } from "@/components/brand/XeccelLogo";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-6">
      <form action={resetPasswordAction} className="w-full max-w-md space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <div className="flex justify-end"><ThemeToggle /></div>
        <XeccelLogo size="login" priority />
        <h1 className="text-xl font-bold text-[var(--heading)]">Choose a new password</h1>
        {params.error && <p className="text-xs text-red-300">The reset link or password was not accepted.</p>}
        <input type="hidden" name="token" value={params.token || ""} />
        <input name="password" type="password" required minLength={12} placeholder="New password" aria-label="New password" className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm" />
        <button className="min-h-12 w-full rounded-full bg-whatsapp px-4 py-2.5 text-sm font-semibold text-[#0b132a] shadow-glow hover:bg-whatsapp-dark">Update password</button>
      </form>
    </main>
  );
}

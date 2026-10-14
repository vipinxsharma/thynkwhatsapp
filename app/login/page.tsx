import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { signInAction, signUpAction } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const errors: Record<string, string> = {
  configuration: "Self-service authentication needs its dedicated Neon project configuration.",
  signin: "The email or password was not accepted.",
  signup: "The account could not be created.",
  validation: "Enter a valid name, email, and a password of at least 12 characters.",
};

const notices: Record<string, string> = {
  "verify-email": "Check your email to verify the account, then sign in.",
  "reset-sent": "If the account exists, password-reset instructions have been sent.",
  "password-reset": "Password updated. You can now sign in.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const signingUp = params.mode === "signup";
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <div className="mb-6 flex justify-end"><ThemeToggle /></div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-whatsapp/20 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-whatsapp-light" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--heading)]">Xeccel</h1>
            <p className="text-xs text-[var(--muted)]">Secure workspace access</p>
          </div>
        </div>

        {params.error && (
          <p className="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
            {errors[params.error] || "The request could not be completed."}
          </p>
        )}
        {params.notice && (
          <p className="mt-6 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-xs text-green-200">
            {notices[params.notice] || "Please continue."}
          </p>
        )}

        <form action={signingUp ? signUpAction : signInAction} className="mt-6 space-y-4">
          {signingUp && (
            <label className="block text-xs text-[var(--muted)]">
              Name
              <input name="name" required minLength={2} className="mt-1 min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm" />
            </label>
          )}
          <label className="block text-xs text-[var(--muted)]">
            Email
            <input name="email" type="email" autoComplete="email" required className="mt-1 min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Password
            <input name="password" type="password" autoComplete={signingUp ? "new-password" : "current-password"} required minLength={12} className="mt-1 min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm" />
          </label>
          <button className="min-h-12 w-full rounded-full bg-whatsapp px-4 py-2.5 text-sm font-semibold text-[#0b132a] shadow-glow hover:bg-whatsapp-dark">
            {signingUp ? "Create workspace" : "Sign in"}
          </button>
        </form>

        <div className="mt-5 flex justify-between text-xs text-[var(--muted)]">
          <Link href={signingUp ? "/login" : "/login?mode=signup"} className="hover:text-[var(--heading)]">
            {signingUp ? "Already have an account?" : "Create an account"}
          </Link>
          {!signingUp && <Link href="/auth/forgot-password" className="hover:text-[var(--heading)]">Forgot password?</Link>}
        </div>
      </section>
    </main>
  );
}

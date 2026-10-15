import Link from "next/link";
import { signInAction, signUpAction } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { XeccelLogo } from "@/components/brand/XeccelLogo";
import { workspaceAccessConfigured } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  configuration: "Account access needs help from our team. Contact support to complete your setup.",
  signin: "The email or password was not accepted.",
  signup: "The account could not be created.",
  validation: "Enter a valid name, email, and a password of at least 12 characters.",
  "workspace-access": "Your workspace access has changed. Contact your workspace administrator or Xeccel support.",
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
  const accessReady = workspaceAccessConfigured();
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <div className="mb-6 flex justify-end"><ThemeToggle /></div>
        <XeccelLogo size="login" priority />
        <h1 className="mt-4 text-xl font-bold text-[var(--heading)]">{signingUp ? "Create your Xeccel workspace" : "Sign in to Xeccel"}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{signingUp ? "Start with your account. Connect your business channel and confirm messaging activation next." : "Access your team, conversations, and customer support."}</p>

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

        {accessReady ? <form action={signingUp ? signUpAction : signInAction} className="mt-6 space-y-4">
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
          {signingUp && <p className="text-xs leading-6 text-[var(--muted)]">Use at least 12 characters for your password. Account creation does not activate paid messaging. Review our <Link href="/legal/terms" className="underline">terms</Link> and <Link href="/legal/privacy" className="underline">privacy policy</Link>.</p>}
        </form> : <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
          <h2 className="font-semibold text-[var(--heading)]">Let us help with your account</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Self-service account access is temporarily unavailable. Contact the Xeccel team to start your setup or get help signing in.</p>
          <a href="mailto:partner@thynkwise.co.in?subject=Xeccel%20account%20setup" className="mt-4 inline-flex min-h-12 items-center rounded-full bg-[var(--accent)] px-5 text-sm font-bold text-[#0b132a]">Contact account support</a>
        </div>}

        <div className="mt-5 flex justify-between text-xs text-[var(--muted)]">
          <Link href={signingUp ? "/login" : "/login?mode=signup"} className="hover:text-[var(--heading)]">
            {signingUp ? "Already have an account?" : "Create an account"}
          </Link>
          {!signingUp && <Link href="/auth/forgot-password" className="hover:text-[var(--heading)]">Forgot password?</Link>}
        </div>
        <div className="mt-6 flex justify-between border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
          <Link href="/" className="underline">Back to Xeccel</Link>
          <Link href="/getting-started" className="underline">Setup guide</Link>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import { requestPasswordResetAction } from "@/app/auth/actions";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-[#090c10] text-gray-200 flex items-center justify-center p-6">
      <form action={requestPasswordResetAction} className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-[#0d1117] p-8">
        <h1 className="text-xl font-bold text-white">Reset your password</h1>
        <p className="text-xs text-gray-400">We will email instructions if the account exists.</p>
        <input name="email" type="email" required placeholder="Email" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm" />
        <button className="w-full rounded-lg bg-whatsapp px-4 py-2.5 text-sm font-semibold text-black">Send reset instructions</button>
        <Link href="/login" className="block text-center text-xs text-gray-400 hover:text-white">Back to sign in</Link>
      </form>
    </main>
  );
}

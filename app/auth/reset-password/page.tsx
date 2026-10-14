import { resetPasswordAction } from "@/app/auth/actions";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="min-h-screen bg-[#090c10] text-gray-200 flex items-center justify-center p-6">
      <form action={resetPasswordAction} className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-[#0d1117] p-8">
        <h1 className="text-xl font-bold text-white">Choose a new password</h1>
        {params.error && <p className="text-xs text-red-300">The reset link or password was not accepted.</p>}
        <input type="hidden" name="token" value={params.token || ""} />
        <input name="password" type="password" required minLength={12} placeholder="New password" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm" />
        <button className="w-full rounded-lg bg-whatsapp px-4 py-2.5 text-sm font-semibold text-black">Update password</button>
      </form>
    </main>
  );
}

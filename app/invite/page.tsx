import { AcceptInvitation } from "@/components/team/AcceptInvitation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function InvitePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6 text-[var(--foreground)]">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><ThemeToggle /></div>
        <h1 className="mb-2 text-center text-2xl font-bold text-[var(--heading)]">Workspace invitation</h1>
        <p className="mb-6 text-center text-sm text-[var(--muted)]">Secure, email-bound access</p>
        <AcceptInvitation />
      </div>
    </main>
  );
}

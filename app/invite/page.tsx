import { AcceptInvitation } from "@/components/team/AcceptInvitation";

export default function InvitePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090c10] p-6 text-gray-200">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-center text-2xl font-bold text-white">Workspace invitation</h1>
        <p className="mb-6 text-center text-sm text-gray-400">Secure, email-bound access</p>
        <AcceptInvitation />
      </div>
    </main>
  );
}

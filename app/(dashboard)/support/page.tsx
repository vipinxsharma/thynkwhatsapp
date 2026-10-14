import { requirePageSession } from "@/lib/auth/session";
import { listSupportCases } from "@/lib/support/store";
import { SupportCenter } from "@/components/support/SupportCenter";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const session = await requirePageSession();
  const cases = await listSupportCases(session.tenantId);
  return (
    <main className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-white">Support</h1>
        <p className="mt-2 mb-6 text-sm text-gray-400">Start a secure support conversation or follow an existing case.</p>
        <SupportCenter initialCases={cases} />
      </div>
    </main>
  );
}

import { LeadNav } from "@/components/leads/LeadNav";
import { LeadList } from "@/components/leads/LeadList";

export default function LeadsPage() {
  return (
    <main className="flex-1 space-y-6 overflow-y-auto p-8">
      <div className="space-y-4 border-b border-white/5 pb-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="mt-1 text-sm text-gray-400">Contacts who tapped a button in your messages, with their source and stage.</p>
        </div>
        <LeadNav active="list" />
      </div>
      <LeadList />
    </main>
  );
}

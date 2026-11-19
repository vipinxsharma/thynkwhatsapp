import { LeadNav } from "@/components/leads/LeadNav";
import { StageBoard } from "@/components/leads/StageBoard";

export default function LeadStageBoardPage() {
  return (
    <main className="flex-1 space-y-6 overflow-y-auto p-8">
      <div className="space-y-4 border-b border-white/5 pb-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Stage board</h1>
          <p className="mt-1 text-sm text-gray-400">Move leads between stages. Stages can be renamed, reordered and deleted.</p>
        </div>
        <LeadNav active="board" />
      </div>
      <StageBoard />
    </main>
  );
}

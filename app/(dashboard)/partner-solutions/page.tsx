import { requirePageSession } from "@/lib/auth/session";
import { PartnerSolutionsView, type PartnerConnectionView } from "@/components/partner-solutions/PartnerSolutionsView";
import { listPartnerConnections } from "@/lib/partner-solutions/store";
import { describePartnerStatus, summarizeConnections } from "@/lib/partner-solutions/status";

export const dynamic = "force-dynamic";

export default async function PartnerSolutionsPage() {
  const session = await requirePageSession();
  const now = new Date();
  let connections: PartnerConnectionView[] = [];
  let summary = summarizeConnections([], now);
  let unavailable = false;
  try {
    const rows = await listPartnerConnections(session.tenantId);
    summary = summarizeConnections(rows, now);
    connections = rows.map((row) => ({ ...row, status: describePartnerStatus(row, now) }));
  } catch {
    unavailable = true;
  }
  return (
    <PartnerSolutionsView
      connections={connections}
      summary={summary}
      canManage={session.role === "owner" || session.role === "admin"}
      unavailable={unavailable}
    />
  );
}

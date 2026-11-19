import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { reconcileRevenue } from "@/lib/revenue/reconcile";
import { loadRevenueInputs } from "@/lib/revenue/store";

const noStore = { "Cache-Control": "no-store" };

/** Attributed revenue per click-to-WhatsApp source. Verified payments only. Spend is not synced yet. */
export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;

  try {
    const input = await loadRevenueInputs(auth.session.tenantId);
    return NextResponse.json({ data: reconcileRevenue(input) }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Revenue report is temporarily unavailable" }, { status: 503, headers: noStore });
  }
}

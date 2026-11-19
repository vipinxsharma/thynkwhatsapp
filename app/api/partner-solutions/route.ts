import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { listPartnerConnections } from "@/lib/partner-solutions/store";
import { describePartnerStatus, summarizeConnections } from "@/lib/partner-solutions/status";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  try {
    const now = new Date();
    const rows = await listPartnerConnections(auth.session.tenantId);
    return NextResponse.json(
      {
        data: {
          summary: summarizeConnections(rows, now),
          connections: rows.map((row) => ({ ...row, status: describePartnerStatus(row, now) })),
        },
      },
      { headers: noStore }
    );
  } catch {
    return NextResponse.json({ error: "Partner solutions are temporarily unavailable" }, { status: 503, headers: noStore });
  }
}

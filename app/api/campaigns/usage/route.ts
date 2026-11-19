import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { campaignAccessBlock } from "@/lib/campaigns/access";
import {
  campaignCharge, countCampaignSendsInMonth, kolkataMonthKey, USAGE_TIMEZONE,
} from "@/lib/campaigns/metering";

const noStore = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

/** This month's campaign sends for the workspace, the included quota, and the charge so far. */
export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const workspaceId = auth.session.tenantId;
  const blocked = await campaignAccessBlock(workspaceId, false);
  if (blocked) return blocked;

  const month = kolkataMonthKey(new Date());
  try {
    const sends = await countCampaignSendsInMonth(workspaceId, month);
    return NextResponse.json(
      { data: { month, timezone: USAGE_TIMEZONE, charge: campaignCharge(sends) } },
      { headers: noStore }
    );
  } catch (error) {
    console.error("[Campaign Usage Error]", error);
    return fail("Campaign usage is temporarily unavailable", 503);
  }
}

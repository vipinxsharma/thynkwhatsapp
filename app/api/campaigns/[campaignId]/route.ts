import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { campaignAccessBlock } from "@/lib/campaigns/access";
import { sendCampaignBatch } from "@/lib/campaigns/sender";
import { getCampaign, listRecipientProblems, transitionCampaign } from "@/lib/campaigns/store";

export const maxDuration = 60;

const noStore = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ campaignId: string }> };

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

export async function GET(request: NextRequest, context: Context) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  const { campaignId } = await context.params;
  if (!UUID.test(campaignId)) return fail("Campaign not found", 404);
  const blocked = await campaignAccessBlock(auth.session.tenantId, false);
  if (blocked) return blocked;
  try {
    const campaign = await getCampaign(auth.session.tenantId, campaignId);
    if (!campaign) return fail("Campaign not found", 404);
    const problems = await listRecipientProblems(auth.session.tenantId, campaignId);
    return NextResponse.json({ data: { campaign, problems } }, { headers: noStore });
  } catch (error) {
    console.error("[Campaign Read Error]", error);
    return fail("The campaign is temporarily unavailable", 503);
  }
}

/** Actions: start, pause, cancel, and send_batch (sends the next batch of a started campaign). */
export async function POST(request: NextRequest, context: Context) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const workspaceId = auth.session.tenantId;
  const { campaignId } = await context.params;
  if (!UUID.test(campaignId)) return fail("Campaign not found", 404);
  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (!["start", "pause", "cancel", "send_batch"].includes(action)) return fail("Unsupported campaign action", 400);

  const blocked = await campaignAccessBlock(workspaceId, action === "start" || action === "send_batch");
  if (blocked) return blocked;

  try {
    if (action === "send_batch") {
      const summary = await sendCampaignBatch({ workspaceId, campaignId });
      if (summary.status === "not_found") return fail("Campaign not found", 404);
      return NextResponse.json({ data: { summary, campaign: await getCampaign(workspaceId, campaignId) } }, { headers: noStore });
    }
    const existing = await getCampaign(workspaceId, campaignId);
    if (!existing) return fail("Campaign not found", 404);
    const moved = await transitionCampaign(workspaceId, campaignId, action);
    if (!moved) return fail(`A ${existing.status} campaign cannot be changed this way`, 409);
    return NextResponse.json({ data: { campaign: await getCampaign(workspaceId, campaignId) } }, { headers: noStore });
  } catch (error) {
    console.error("[Campaign Action Error]", error);
    return fail("The campaign action could not be completed. Check its status before trying again.", 503);
  }
}

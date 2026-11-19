import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sendCampaignBatch } from "@/lib/campaigns/sender";
import { listSendingCampaigns } from "@/lib/campaigns/store";
import { isDurableInboxEnabled } from "@/lib/strapi/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") || "");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

/**
 * Background worker for campaigns: sends one batch for each campaign that is `sending`.
 * Not scheduled in vercel.json; call it from a scheduler with `Authorization: Bearer <CRON_SECRET>`
 * so campaigns keep sending when nobody has the campaign page open.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: "Scheduled jobs are not configured" }, { status: 503 });
  }
  if (!authorized(request, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDurableInboxEnabled()) {
    return NextResponse.json({ error: "Durable storage is not configured" }, { status: 503 });
  }
  const started = Date.now();
  const results: Array<{ campaignId: string; sent: number; failed: number; status: string }> = [];
  try {
    for (const campaign of await listSendingCampaigns(10)) {
      const remaining = 45_000 - (Date.now() - started);
      if (remaining < 5_000) break;
      const summary = await sendCampaignBatch({
        workspaceId: campaign.workspaceId, campaignId: campaign.id, deadlineMs: Math.min(remaining - 3_000, 15_000),
      });
      results.push({ campaignId: campaign.id, sent: summary.sent, failed: summary.failed, status: summary.status });
    }
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("[Campaign Worker Error]", error);
    return NextResponse.json({ error: "Campaign worker run failed", data: results }, { status: 500 });
  }
}

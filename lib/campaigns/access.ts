import { NextResponse } from "next/server";
import { evaluateEntitlement, getEntitlementSnapshot } from "@/lib/billing/entitlements";
import { isDurableInboxEnabled } from "@/lib/strapi/client";

const noStore = { "Cache-Control": "no-store" };

/**
 * Campaigns need durable Postgres storage everywhere, and in production the
 * workspace's plan must grant campaign sending. Returns a response when blocked.
 */
export async function campaignAccessBlock(workspaceId: string, sending: boolean): Promise<NextResponse | null> {
  if (!isDurableInboxEnabled()) {
    return NextResponse.json({ error: "Campaigns need durable storage, which is not configured" }, { status: 503, headers: noStore });
  }
  if (!sending || process.env.NODE_ENV !== "production") return null;
  try {
    const access = evaluateEntitlement(await getEntitlementSnapshot(workspaceId), "campaign_send");
    if (access.allowed) return null;
    return NextResponse.json(
      { error: "Campaign sending is not active on this workspace's plan", code: access.reason },
      { status: 403, headers: noStore }
    );
  } catch {
    return NextResponse.json({ error: "Subscription status is temporarily unavailable" }, { status: 503, headers: noStore });
  }
}

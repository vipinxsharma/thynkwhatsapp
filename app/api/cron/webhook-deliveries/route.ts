import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processDueWebhookDeliveries } from "@/lib/developer/webhook-delivery";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") || "");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

/**
 * Retries due outbound webhook deliveries. Deliveries are also attempted right after each event,
 * so this route only matters for retries. It is not listed in vercel.json; add a schedule there
 * only once you decide to run it on a timer. The CRON_SECRET bearer token is required.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: "Scheduled jobs are not configured" }, { status: 503 });
  }
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Webhook storage is not configured" }, { status: 503 });
  }
  try {
    return NextResponse.json({ success: true, data: await processDueWebhookDeliveries({ limit: 50 }) });
  } catch (error) {
    console.error("[Webhook Delivery Worker Error]", error);
    return NextResponse.json({ error: "Webhook delivery run failed" }, { status: 500 });
  }
}

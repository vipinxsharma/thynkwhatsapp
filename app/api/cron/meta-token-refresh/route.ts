import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { refreshExpiringTokens } from "@/lib/meta/token-refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") || "");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

/**
 * Daily job (see vercel.json): refreshes Meta business tokens that are close to expiry.
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: "Scheduled jobs are not configured" }, { status: 503 });
  }
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL || !process.env.ENCRYPTION_KEY) {
    return NextResponse.json({ error: "Durable Meta onboarding storage is not configured" }, { status: 503 });
  }
  try {
    return NextResponse.json({ success: true, data: await refreshExpiringTokens() });
  } catch (error) {
    console.error("[Meta Token Refresh Error]", error);
    return NextResponse.json({ error: "Token refresh run failed" }, { status: 500 });
  }
}

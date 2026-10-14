import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";

// This endpoint intentionally cannot send in any environment. The previous
// development path could fall back from an empty segment to every contact and
// had no durable consent, job, receipt, or idempotency record.
export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    { error: "Campaign sending is unavailable until consent and durable delivery are implemented" },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}

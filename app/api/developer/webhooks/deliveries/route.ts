import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { developerStorageConfigured } from "@/lib/developer/db";
import { listWebhookDeliveries } from "@/lib/developer/webhook-store";

/** Recent deliveries for the workspace, newest first. Payloads and secrets are not included. */
export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  if (!developerStorageConfigured()) return NextResponse.json({ error: "Developer API storage is not configured" }, { status: 503 });
  const limit = Number(request.nextUrl.searchParams.get("limit") || 50);
  return NextResponse.json({ data: await listWebhookDeliveries(auth.session.tenantId, Number.isFinite(limit) ? limit : 50) });
}

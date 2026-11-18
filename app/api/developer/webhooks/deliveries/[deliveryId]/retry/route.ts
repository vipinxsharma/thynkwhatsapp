import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { developerStorageConfigured } from "@/lib/developer/db";
import { isUuid } from "@/lib/developer/validation";
import { requeueFailedDelivery } from "@/lib/developer/webhook-store";
import { scheduleWebhookProcessing } from "@/lib/developer/webhook-delivery";

/** Requeues a failed delivery with a fresh set of attempts. */
export async function POST(request: NextRequest, context: { params: Promise<{ deliveryId: string }> }) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  if (!developerStorageConfigured()) return NextResponse.json({ error: "Developer API storage is not configured" }, { status: 503 });
  const { deliveryId } = await context.params;
  if (!isUuid(deliveryId)) return NextResponse.json({ error: "Invalid delivery" }, { status: 400 });

  const requeued = await requeueFailedDelivery({ workspaceId: auth.session.tenantId, deliveryId });
  if (!requeued) return NextResponse.json({ error: "Only failed deliveries can be retried" }, { status: 404 });
  scheduleWebhookProcessing();
  return NextResponse.json({ success: true });
}

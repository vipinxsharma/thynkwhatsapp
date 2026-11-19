import { NextRequest, NextResponse } from "next/server";
import { requirePlatformApiSuperadmin } from "@/lib/auth/platform-api";
import { removePlatformWhatsAppNumber } from "@/lib/meta/connections";

const uuid = /^[0-9a-f-]{36}$/i;
const phoneNumberId = /^[0-9]{5,25}$/;

export async function DELETE(request: NextRequest) {
  const auth = await requirePlatformApiSuperadmin(request);
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as { workspaceId?: unknown; phoneNumberId?: unknown } | null;
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : "";
  const number = typeof body?.phoneNumberId === "string" ? body.phoneNumberId : "";
  if (!uuid.test(workspaceId) || !phoneNumberId.test(number)) {
    return NextResponse.json({ error: "Invalid workspace or phone number id" }, { status: 400 });
  }
  const removed = await removePlatformWhatsAppNumber(workspaceId, number);
  if (!removed) return NextResponse.json({ error: "Number not found in that workspace" }, { status: 404 });
  return NextResponse.json({ success: true });
}

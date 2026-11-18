import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { revokeApiKey } from "@/lib/developer/api-key-store";
import { developerStorageConfigured } from "@/lib/developer/db";
import { isUuid } from "@/lib/developer/validation";

/** Revokes a key immediately. Revocation cannot be undone; create a new key instead. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ keyId: string }> }) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  if (!developerStorageConfigured()) return NextResponse.json({ error: "Developer API storage is not configured" }, { status: 503 });
  const { keyId } = await context.params;
  if (!isUuid(keyId)) return NextResponse.json({ error: "Invalid API key" }, { status: 400 });

  const revoked = await revokeApiKey({
    workspaceId: auth.session.tenantId,
    authUserId: auth.session.userId,
    keyId,
  });
  return revoked
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: "API key not found or already revoked" }, { status: 404 });
}

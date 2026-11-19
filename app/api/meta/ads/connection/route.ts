import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { decryptToken } from "@/lib/meta/encryption";
import { getAdsConnection, getEncryptedAdsToken, markAdsDisconnected } from "@/lib/ads/connection-store";
import { revokeAdsRead } from "@/lib/ads/graph";

const noStore = { "Cache-Control": "no-store" };

/** Connection status for the workspace. Never returns the token. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin"]);
    if (!auth.ok) {
      auth.response.headers.set("Cache-Control", "no-store");
      return auth.response;
    }
    const connection = await getAdsConnection(auth.session.tenantId);
    return NextResponse.json(
      {
        connected: connection?.status === "connected",
        connection: connection ?? null,
        scope: "ads_read",
      },
      { headers: noStore },
    );
  } catch (error: any) {
    console.error("[Meta Ads Connection GET Error]", error);
    return NextResponse.json({ error: "Failed to read the ad account connection" }, { status: 500, headers: noStore });
  }
}

/**
 * Disconnects the workspace. The stored token is removed locally in every case. Meta is asked to drop
 * the ads_read grant too; if that call fails the response says so, so the user can remove it in Meta.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin"]);
    if (!auth.ok) {
      auth.response.headers.set("Cache-Control", "no-store");
      return auth.response;
    }
    const workspaceId = auth.session.tenantId;
    const encrypted = await getEncryptedAdsToken(workspaceId);
    let revokedAtMeta = false;
    if (encrypted) {
      try {
        revokedAtMeta = await revokeAdsRead(decryptToken(encrypted));
      } catch {
        revokedAtMeta = false;
      }
    }
    const removed = await markAdsDisconnected(workspaceId);
    return NextResponse.json(
      { status: "disconnected", removed, revokedAtMeta },
      { headers: noStore },
    );
  } catch (error: any) {
    console.error("[Meta Ads Connection DELETE Error]", error);
    return NextResponse.json({ error: "Failed to disconnect the ad account" }, { status: 500, headers: noStore });
  }
}

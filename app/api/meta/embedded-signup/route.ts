import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { MetaGraphClient } from "@/lib/meta/client";
import { saveMetaConnection, validMetaIdentifier } from "@/lib/meta/connections";
import { encryptToken } from "@/lib/meta/encryption";

interface EmbeddedSignupRequestBody {
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
  channelName?: string;
}

/**
 * Handles the OAuth authorization code returned by Meta Embedded Signup popup
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin"]);
    if (!auth.ok) return auth.response;
    const body: EmbeddedSignupRequestBody = await request.json();
    const { code, wabaId, phoneNumberId, channelName } = body;
    if (!code || !wabaId || !phoneNumberId) {
      return NextResponse.json(
        { error: "Authorization code, WABA ID, and phone number ID are required" },
        { status: 400 }
      );
    }

    if (!validMetaIdentifier(wabaId) || !validMetaIdentifier(phoneNumberId)) {
      return NextResponse.json({ error: "Invalid Meta account identifiers" }, { status: 400 });
    }
    if (typeof channelName !== "string" || !channelName.trim() || channelName.trim().length > 60) {
      return NextResponse.json({ error: "Channel name must contain 1–60 characters" }, { status: 400 });
    }

    if (!process.env.DATABASE_URL || !process.env.ENCRYPTION_KEY) {
      return NextResponse.json(
        { error: "Durable Meta onboarding storage is not configured" },
        { status: 503 }
      );
    }

    const tokenResponse = await MetaGraphClient.exchangeCodeForToken(code);
    const accessToken = tokenResponse.access_token;
    const metaClient = new MetaGraphClient(accessToken);
    const ownership = await metaClient.verifyPhoneOwnership(wabaId, phoneNumberId);
    const subscription = await metaClient.subscribeWabaToWebhook(wabaId);
    if (!subscription.success) throw new Error("Meta did not confirm webhook subscription");

    await saveMetaConnection({
      workspaceId: auth.session.tenantId,
      authUserId: auth.session.userId,
      ownership: { wabaId, phoneNumberId, ...ownership },
      encryptedToken: encryptToken(accessToken),
      channelName: channelName.trim(),
    });

    return NextResponse.json({
      success: true,
      data: {
        wabaId,
        phoneNumberId,
        displayPhoneNumber: ownership.displayPhoneNumber,
        verifiedName: ownership.verifiedName,
        status: "CONNECTED",
        webhookSubscribed: true,
      },
    });
  } catch (error: any) {
    console.error("[Embedded Signup Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to process Meta Embedded Signup" },
      { status: 500 }
    );
  }
}

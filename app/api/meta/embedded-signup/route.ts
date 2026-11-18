import crypto from "node:crypto";
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
  finishType?: "cloud_api" | "business_app";
}

class SignupInputError extends Error {}

/**
 * Meta can return a code without the session event (for example when a returning user
 * continues with previous settings). Recover the account from the token itself, but only
 * when there is exactly one WABA with exactly one number, so nothing is guessed.
 */
async function discoverSingleNumber(client: MetaGraphClient): Promise<{ wabaId: string; phoneNumberId: string }> {
  const wabaIds = await client.listGrantedWabaIds();
  if (wabaIds.length === 0) {
    throw new SignupInputError(
      "This Meta login did not share a WhatsApp Business account with Xeccel. " +
      "Start the signup again, choose Edit Settings, and select the WhatsApp account and number to connect."
    );
  }
  if (wabaIds.length > 1) {
    throw new SignupInputError(
      "This Meta login shared more than one WhatsApp Business account. " +
      "Start the signup again and complete every step so Meta tells Xeccel which number to connect."
    );
  }
  const numbers = await client.listPhoneNumbers(wabaIds[0]);
  if (numbers.length !== 1) {
    throw new SignupInputError(
      numbers.length === 0
        ? "The shared WhatsApp Business account has no phone number yet. Add a number in the Meta signup and try again."
        : "The shared WhatsApp Business account has several phone numbers. Start the signup again and pick the number to connect."
    );
  }
  return { wabaId: wabaIds[0], phoneNumberId: String(numbers[0].id) };
}

/**
 * Handles the OAuth authorization code returned by Meta Embedded Signup popup
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin"]);
    if (!auth.ok) return auth.response;
    const body: EmbeddedSignupRequestBody = await request.json();
    const { code, channelName, finishType } = body;
    let { wabaId, phoneNumberId } = body;
    if (typeof code !== "string" || !code) {
      return NextResponse.json({ error: "Authorization code is required" }, { status: 400 });
    }
    // Both IDs come from Meta's session event; accept both or neither, never a guess at one.
    const hasIds = Boolean(wabaId) && Boolean(phoneNumberId);
    if (!hasIds && (wabaId || phoneNumberId)) {
      return NextResponse.json({ error: "WABA ID and phone number ID must be sent together" }, { status: 400 });
    }
    if (hasIds && (!validMetaIdentifier(String(wabaId)) || !validMetaIdentifier(String(phoneNumberId)))) {
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
    if (!hasIds) ({ wabaId, phoneNumberId } = await discoverSingleNumber(metaClient));
    if (!wabaId || !phoneNumberId) throw new Error("Meta did not identify the WhatsApp account to connect");

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

    // Tech Provider onboarding step 3: a new Cloud API number cannot send or receive until it
    // is registered. WhatsApp Business app (coexistence) numbers are already registered.
    // The connection is saved first so a registration problem never loses the signup.
    let registered = finishType === "business_app";
    let registrationWarning: string | undefined;
    if (!registered) {
      try {
        registered = (await metaClient.getPhoneRegistration(phoneNumberId)).registered;
        if (!registered) {
          // The PIN becomes the number's two-step verification PIN. It is not stored: the
          // customer can change it in WhatsApp Manager, and the business token can reset it.
          await metaClient.registerPhoneNumber(phoneNumberId, String(crypto.randomInt(100000, 1000000)));
          registered = true;
        }
      } catch (error) {
        console.error("[Embedded Signup Registration Error]", error);
        registrationWarning =
          "The number is saved, but Meta did not register it for the Cloud API yet. " +
          "Check its two-step verification PIN in WhatsApp Manager, then use Check with Meta.";
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        wabaId,
        phoneNumberId,
        displayPhoneNumber: ownership.displayPhoneNumber,
        verifiedName: ownership.verifiedName,
        status: "CONNECTED",
        webhookSubscribed: true,
        registered,
        ...(registrationWarning ? { warning: registrationWarning } : {}),
      },
    });
  } catch (error: any) {
    if (error instanceof SignupInputError) {
      return NextResponse.json({ error: error.message, code: "no_whatsapp_account" }, { status: 422 });
    }
    console.error("[Embedded Signup Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to process Meta Embedded Signup" },
      { status: 500 }
    );
  }
}

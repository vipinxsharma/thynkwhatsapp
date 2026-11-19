import { buttonTapFromMessage, type InboundMessageLike } from "./rules";
import { recordButtonTap } from "./store";
import { adReferralFromInbound } from "../ads/referral";
import { recordAdAttribution } from "../ads/attribution-store";

/**
 * Called from the Meta webhook after an inbound message is recorded.
 * Stores a lead for a button tap, and stores click-to-WhatsApp referral attribution for the contact
 * whenever the message carries a referral (with or without a button). Each step is handled on its own:
 * a failure is logged and swallowed, so a lead or attribution problem never fails the webhook.
 * A failed response would make Meta redeliver the message.
 */
export async function captureLeadFromInbound(
  workspaceId: string,
  contactId: string,
  msg: InboundMessageLike,
): Promise<void> {
  try {
    const tap = buttonTapFromMessage(msg);
    if (tap) {
      const recorded = await recordButtonTap(workspaceId, contactId, tap);
      if (recorded) {
        console.log(`[Lead Capture] Recorded button tap ${tap.wamId} for contact ${contactId}`);
      }
    }
  } catch (error) {
    console.error("[Lead Capture] Failed to record button tap", error);
  }

  try {
    const referral = adReferralFromInbound(msg.referral);
    if (!referral) return;
    const recorded = await recordAdAttribution(
      workspaceId,
      contactId,
      msg.id,
      referredAtFromTimestamp(msg.timestamp),
      referral,
    );
    if (recorded) {
      console.log(`[Lead Capture] Recorded ${referral.sourceType} referral ${referral.sourceId} for contact ${contactId}`);
    }
  } catch (error) {
    console.error("[Lead Capture] Failed to record ad attribution", error);
  }
}

function referredAtFromTimestamp(timestamp: string): string {
  const seconds = Number.parseInt(timestamp, 10);
  return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : new Date().toISOString();
}

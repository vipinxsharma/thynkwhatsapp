import { buttonTapFromMessage, type InboundMessageLike } from "./rules";
import { recordButtonTap } from "./store";

/**
 * Called from the Meta webhook after an inbound message is recorded.
 * Stores a lead only for button taps. Any failure is logged and swallowed, so a lead-storage
 * problem never fails the webhook. A failed response would make Meta redeliver the message.
 */
export async function captureLeadFromInbound(
  workspaceId: string,
  contactId: string,
  msg: InboundMessageLike,
): Promise<void> {
  try {
    const tap = buttonTapFromMessage(msg);
    if (!tap) return;
    const recorded = await recordButtonTap(workspaceId, contactId, tap);
    if (recorded) {
      console.log(`[Lead Capture] Recorded button tap ${tap.wamId} for contact ${contactId}`);
    }
  } catch (error) {
    console.error("[Lead Capture] Failed to record button tap", error);
  }
}

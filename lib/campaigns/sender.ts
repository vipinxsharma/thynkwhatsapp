import { MetaGraphClient, MetaSendError } from "@/lib/meta/client";
import { getMetaConnectionForNumber } from "@/lib/meta/connections";
import { recordMessage } from "@/lib/inbox/store";
import { buildCampaignPayload } from "@/lib/campaigns/template";
import {
  batchClaimLimit, campaignLevelPauseReason, DAILY_SEND_CAP, DAILY_WINDOW_HOURS, msUntilNextSend,
  qualityPauseReason, remainingDailyBudget,
} from "@/lib/campaigns/pacing";
import {
  claimRecipients, completeCampaignIfDone, countNumberSendsInWindow, expireStuckRecipients, findConversationId,
  getCampaign, getChannelQualityRating, optedInContactIds, recordSendAttempt, settleRecipient, transitionCampaign,
  type CampaignStatus, type ClaimedRecipient, type SendOutcome,
} from "@/lib/campaigns/store";

export interface BatchSummary {
  status: CampaignStatus | "not_found";
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
  uncertain: number;
  released: number;
  pausedReason: string | null;
  /** Set when the rolling 24-hour cap left no room to send in this batch. Nothing was claimed. */
  capReason: string | null;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Sends one batch of a campaign. Safe to call repeatedly and concurrently: each recipient is
 * claimed by exactly one caller, and an outcome that cannot be known is recorded as
 * `uncertain` and never retried, so nobody receives the same campaign twice.
 *
 * Pacing: sends from one number are spaced to SENDS_PER_SECOND and limited to DAILY_SEND_CAP in
 * a rolling 24 hours. A campaign pauses (and does not auto-resume) when Meta returns a
 * campaign-level error or the number's quality rating is YELLOW or RED.
 */
export async function sendCampaignBatch(input: {
  workspaceId: string;
  campaignId: string;
  limit?: number;
  deadlineMs?: number;
}): Promise<BatchSummary> {
  const summary: BatchSummary = {
    status: "not_found", claimed: 0, sent: 0, failed: 0, skipped: 0, uncertain: 0, released: 0,
    pausedReason: null, capReason: null,
  };
  const deadline = Date.now() + (input.deadlineMs ?? 20_000);
  const { workspaceId, campaignId } = input;

  await expireStuckRecipients(workspaceId, campaignId);
  const campaign = await getCampaign(workspaceId, campaignId);
  if (!campaign) return summary;
  summary.status = campaign.status;
  if (campaign.status !== "sending") return summary;

  const pause = async (reason: string) => {
    summary.pausedReason = reason;
    await transitionCampaign(workspaceId, campaignId, "pause", reason);
    summary.status = "paused";
  };

  const connection = await getMetaConnectionForNumber(workspaceId, campaign.phoneNumberId);
  if (!connection) {
    await pause("Sending paused: this campaign's WhatsApp number is no longer connected");
    return summary;
  }

  // Automatic pause: a YELLOW or RED number must not keep sending. Checked before anything is claimed.
  const qualityReason = qualityPauseReason(
    await getChannelQualityRating(workspaceId, campaign.phoneNumberId), campaign.phoneNumberId
  );
  if (qualityReason) {
    await pause(qualityReason);
    return summary;
  }

  // Daily cap: claim no more than the rolling 24-hour budget left for this number.
  const sendsInWindow = await countNumberSendsInWindow(workspaceId, campaign.phoneNumberId, DAILY_WINDOW_HOURS);
  const claimLimit = batchClaimLimit(input.limit ?? 40, remainingDailyBudget(sendsInWindow));
  if (claimLimit === 0) {
    summary.capReason = `Daily cap of ${DAILY_SEND_CAP} sends for this WhatsApp number reached in the last ` +
      `${DAILY_WINDOW_HOURS} hours. Remaining recipients stay pending and send once capacity frees up.`;
    return summary;
  }
  const client = new MetaGraphClient(connection.accessToken);

  const claimed = await claimRecipients(workspaceId, campaignId, claimLimit);
  summary.claimed = claimed.length;
  const optedIn = await optedInContactIds(workspaceId, claimed.map((recipient) => recipient.contactId));

  const release = async (recipients: ClaimedRecipient[]) => {
    for (const recipient of recipients) {
      await settleRecipient({ recipientId: recipient.id, status: "pending" });
      summary.released += 1;
    }
  };

  // The send log is best effort after the recipient's status is settled: the status is what
  // prevents duplicate sends, and a missing log row is reported, never retried.
  const logAttempt = async (recipientId: string, outcome: SendOutcome, detail: {
    httpStatus: number | null; metaCode: number | null; error: string | null;
  }) => {
    try {
      await recordSendAttempt({ campaignId, recipientId, outcome, ...detail });
    } catch (error) {
      console.error("[Campaign Send Log Error]", error);
    }
  };

  let lastSendAt: number | null = null;

  for (let index = 0; index < claimed.length; index += 1) {
    const recipient = claimed[index];
    if (Date.now() > deadline) {
      await release(claimed.slice(index));
      break;
    }
    if (!optedIn.has(recipient.contactId)) {
      await settleRecipient({ recipientId: recipient.id, status: "skipped", error: "Contact is not opted in" });
      summary.skipped += 1;
      continue;
    }

    // Per-second pacing: wait for the gap, or hand the rest back if waiting would pass the deadline.
    const wait = msUntilNextSend(lastSendAt, Date.now());
    if (wait > 0) {
      if (Date.now() + wait > deadline) {
        await release(claimed.slice(index));
        break;
      }
      await sleep(wait);
    }

    const payload = buildCampaignPayload({
      templateName: campaign.templateName,
      templateLanguage: campaign.templateLanguage,
      variables: campaign.templateVariables,
      recipient: { name: recipient.contactName, waId: recipient.waId },
    });

    let wamId: string | undefined;
    lastSendAt = Date.now();
    try {
      const response = await client.sendMessage(campaign.phoneNumberId, payload);
      wamId = response.messages[0]?.id;
      if (!wamId) throw new Error("Meta did not return a message ID");
    } catch (error) {
      const httpStatus = error instanceof MetaSendError ? error.httpStatus : null;
      const metaCode = error instanceof MetaSendError ? error.code : null;
      const message = error instanceof Error ? error.message : "Unknown send error";

      if (error instanceof MetaSendError && error.httpStatus < 500) {
        // Meta refused before accepting anything, so the attempt is safe to repeat later.
        const reason = campaignLevelPauseReason({ message, httpStatus: error.httpStatus, code: error.code });
        if (reason) {
          await logAttempt(recipient.id, "rejected", { httpStatus, metaCode, error: message });
          await release(claimed.slice(index));
          await pause(reason);
          return summary;
        }
        await settleRecipient({ recipientId: recipient.id, status: "failed", error: message });
        await logAttempt(recipient.id, "rejected", { httpStatus, metaCode, error: message });
        summary.failed += 1;
      } else {
        // No usable answer from Meta: the message may have gone out, so it is never retried.
        await settleRecipient({ recipientId: recipient.id, status: "uncertain", error: `Outcome unknown: ${message}` });
        await logAttempt(recipient.id, "uncertain", { httpStatus, metaCode, error: message });
        summary.uncertain += 1;
      }
      continue;
    }

    await settleRecipient({ recipientId: recipient.id, status: "sent", wamId });
    await logAttempt(recipient.id, "accepted", { httpStatus: 200, metaCode: null, error: null });
    summary.sent += 1;
    try {
      const conversationId = await findConversationId(workspaceId, recipient.contactId, campaign.phoneNumberId);
      if (conversationId) {
        await recordMessage(workspaceId, conversationId, {
          wamId, direction: "outbound", type: "template",
          body: `[Campaign: ${campaign.name} · Template: ${campaign.templateName}]`,
          rawPayload: payload, status: "sent", timestamp: new Date().toISOString(),
        } as Parameters<typeof recordMessage>[2]);
      }
    } catch (error) {
      console.error("[Campaign Inbox Record Error]", error);
    }
  }

  if (await completeCampaignIfDone(workspaceId, campaignId)) summary.status = "completed";
  return summary;
}

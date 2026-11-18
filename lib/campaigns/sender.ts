import { MetaGraphClient, MetaSendError } from "@/lib/meta/client";
import { getMetaConnectionForNumber } from "@/lib/meta/connections";
import { recordMessage } from "@/lib/inbox/store";
import { buildCampaignPayload } from "@/lib/campaigns/template";
import {
  claimRecipients, completeCampaignIfDone, expireStuckRecipients, findConversationId, getCampaign,
  optedInContactIds, settleRecipient, transitionCampaign, type CampaignStatus, type ClaimedRecipient,
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
}

// Meta error codes that mean "stop the whole campaign", not "this recipient failed":
// rate and volume limits, an unusable token or account, a billing problem, or a template
// that no longer matches. Recipients are put back so they are sent after the cause is fixed.
const CAMPAIGN_LEVEL_CODES = new Set([
  4, 80007, 130429, 131048, 131056, // throughput, spam and pair rate limits
  190, 10, 200, 131031, 131045, // token, permission, account locked, number not registered
  131042, // payment method problem
  132000, 132001, 132007, 132012, 132015, 132016, // template missing, paused, disabled or mismatched
]);

function campaignLevelReason(error: MetaSendError): string | null {
  if (error.httpStatus === 429 || (error.code !== null && CAMPAIGN_LEVEL_CODES.has(error.code))) {
    return `Sending paused: ${error.message}`;
  }
  return null;
}

/**
 * Sends one batch of a campaign. Safe to call repeatedly and concurrently: each recipient is
 * claimed by exactly one caller, and an outcome that cannot be known is recorded as
 * `uncertain` and never retried, so nobody receives the same campaign twice.
 */
export async function sendCampaignBatch(input: {
  workspaceId: string;
  campaignId: string;
  limit?: number;
  deadlineMs?: number;
}): Promise<BatchSummary> {
  const summary: BatchSummary = {
    status: "not_found", claimed: 0, sent: 0, failed: 0, skipped: 0, uncertain: 0, released: 0, pausedReason: null,
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
  const client = new MetaGraphClient(connection.accessToken);

  const claimed = await claimRecipients(workspaceId, campaignId, input.limit ?? 40);
  summary.claimed = claimed.length;
  const optedIn = await optedInContactIds(workspaceId, claimed.map((recipient) => recipient.contactId));

  const release = async (recipients: ClaimedRecipient[]) => {
    for (const recipient of recipients) {
      await settleRecipient({ recipientId: recipient.id, status: "pending" });
      summary.released += 1;
    }
  };

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
    const payload = buildCampaignPayload({
      templateName: campaign.templateName,
      templateLanguage: campaign.templateLanguage,
      variables: campaign.templateVariables,
      recipient: { name: recipient.contactName, waId: recipient.waId },
    });

    let wamId: string | undefined;
    try {
      const response = await client.sendMessage(campaign.phoneNumberId, payload);
      wamId = response.messages[0]?.id;
      if (!wamId) throw new Error("Meta did not return a message ID");
    } catch (error) {
      if (error instanceof MetaSendError && error.httpStatus < 500) {
        const reason = campaignLevelReason(error);
        if (reason) {
          // Meta refused before accepting anything, so these are safe to send later.
          await release(claimed.slice(index));
          await pause(reason);
          return summary;
        }
        await settleRecipient({ recipientId: recipient.id, status: "failed", error: error.message });
        summary.failed += 1;
      } else {
        const message = error instanceof Error ? error.message : "Unknown send error";
        await settleRecipient({ recipientId: recipient.id, status: "uncertain", error: `Outcome unknown: ${message}` });
        summary.uncertain += 1;
      }
      continue;
    }

    await settleRecipient({ recipientId: recipient.id, status: "sent", wamId });
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

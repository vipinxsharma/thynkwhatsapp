import { NextRequest, NextResponse } from "next/server";
import { StrapiClient } from "@/lib/strapi/client";
import { CampaignStore } from "@/lib/campaigns/store";
import { MetaGraphClient } from "@/lib/meta/client";
import { emitNewInboundMessage } from "@/lib/events/emitter";
import { requireApiSession } from "@/lib/auth/session";
import { getMetaConnectionForWorkspace } from "@/lib/meta/connections";
import type { MetaSendMessagePayload } from "@/types/meta-api";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin"]);
    if (!auth.ok) return auth.response;
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Durable inbox storage is not configured" }, { status: 503 });
    }
    const strapiClient = new StrapiClient(auth.session.tenantId);

    const body = await request.json();
    const {
      name,
      templateName,
      templateLanguage = "en_US",
      templateVariables = [],
      segment = "all",
    } = body;

    if (!templateName) {
      return NextResponse.json({ error: "templateName is required" }, { status: 400 });
    }

    const conversations = await strapiClient.getConversations();
    const templates = await strapiClient.getTemplates();
    const targetTemplate = templates.find((t) => t.name === templateName);
    const category = targetTemplate?.category || "MARKETING";

    // Filter target recipients based on segment
    let targetConversations = conversations;
    if (segment === "leads") {
      targetConversations = conversations.filter((c) =>
        (c.contact.tags || []).some((t) => t.toLowerCase().includes("lead") || t.toLowerCase().includes("intent"))
      );
    } else if (segment === "customers") {
      targetConversations = conversations.filter((c) =>
        (c.contact.tags || []).some((t) => t.toLowerCase().includes("paid") || t.toLowerCase().includes("customer"))
      );
    }

    if (targetConversations.length === 0) {
      targetConversations = conversations; // fallback to all
    }

    const totalRecipients = targetConversations.length;
    let sentCount = 0;
    let deliveredCount = 0;
    let readCount = 0;
    let failedCount = 0;

    const ratePerConv = category === "MARKETING" ? 0.075 : 0.015;
    const connection = await getMetaConnectionForWorkspace(auth.session.tenantId);
    const metaClient = new MetaGraphClient(connection.accessToken);

    // Iterate through recipients and record outbound messages
    for (const conv of targetConversations) {
      try {
        const metaPayload: MetaSendMessagePayload = {
          messaging_product: "whatsapp",
          to: conv.contact.waId.replace(/\D/g, ""),
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLanguage },
            components:
              templateVariables.length > 0
                ? [{
                    type: "body",
                    parameters: templateVariables.map((value: string) => ({ type: "text", text: value })),
                  }]
                : undefined,
          },
        };
        const metaResponse = await metaClient.sendMessage(connection.phoneNumberId, metaPayload);
        const wamId = metaResponse.messages[0]?.id;
        if (!wamId) throw new Error("Meta did not return a message ID");
        const recordedMessage = await strapiClient.recordMessage(conv.id, {
          wamId,
          direction: "outbound",
          type: "template",
          body: `[Broadcast Template: ${templateName}]`,
          rawPayload: metaPayload,
          status: "sent",
          timestamp: new Date().toISOString(),
        });

        emitNewInboundMessage(auth.session.tenantId, conv.id, recordedMessage);
        sentCount++;
        // Delivery and read counts are updated only by verified Meta webhooks.
      } catch (err) {
        failedCount++;
      }
    }

    const estimatedCostUSD = parseFloat((sentCount * ratePerConv).toFixed(2));

    const campaignRecord = CampaignStore.add(auth.session.tenantId, {
      name: name || `Broadcast - ${templateName}`,
      templateName,
      segment,
      totalRecipients,
      sentCount,
      deliveredCount,
      readCount,
      failedCount,
      estimatedCostUSD,
      status: "completed",
    });

    return NextResponse.json({
      success: true,
      message: `Broadcast accepted by Meta for ${sentCount} of ${totalRecipients} recipients. Delivery and read counts update from webhooks.`,
      data: campaignRecord,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to execute broadcast campaign" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { campaignAccessBlock } from "@/lib/campaigns/access";
import { countAudience, createCampaign, listCampaigns } from "@/lib/campaigns/store";
import { inspectTemplate } from "@/lib/campaigns/template";
import { MetaGraphClient } from "@/lib/meta/client";
import { getMetaConnectionForNumber } from "@/lib/meta/connections";

const noStore = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  const blocked = await campaignAccessBlock(auth.session.tenantId, false);
  if (blocked) return blocked;
  try {
    return NextResponse.json({ data: await listCampaigns(auth.session.tenantId) }, { headers: noStore });
  } catch (error) {
    console.error("[Campaign List Error]", error);
    return fail("Campaigns are temporarily unavailable", 503);
  }
}

/**
 * Creates a draft campaign and snapshots its recipients. Nothing is sent here:
 * sending starts only when an owner or admin starts the campaign.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const workspaceId = auth.session.tenantId;
  const blocked = await campaignAccessBlock(workspaceId, false);
  if (blocked) return blocked;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phoneNumberId = typeof body?.phoneNumberId === "string" ? body.phoneNumberId : "";
  const templateName = typeof body?.templateName === "string" ? body.templateName : "";
  const templateLanguage = typeof body?.templateLanguage === "string" ? body.templateLanguage : "";
  const audienceTag = typeof body?.audienceTag === "string" && body.audienceTag.trim() ? body.audienceTag.trim() : null;
  const variables: unknown[] = Array.isArray(body?.templateVariables) ? body.templateVariables : [];

  if (!UUID.test(id)) return fail("A campaign id (UUID) is required", 400);
  if (name.length < 1 || name.length > 120) return fail("Campaign name must contain 1–120 characters", 400);
  if (!/^\d{5,30}$/.test(phoneNumberId)) return fail("Choose the WhatsApp number to send from", 400);
  if (!/^[a-z0-9_]{1,512}$/.test(templateName) || !/^[a-zA-Z_]{2,10}$/.test(templateLanguage)) {
    return fail("Choose an approved template", 400);
  }
  if (!variables.every((value) => typeof value === "string" && value.trim().length > 0 && value.length <= 500)) {
    return fail("Every template variable needs a value", 400);
  }
  const templateVariables = (variables as string[]).map((value) => value.trim());

  try {
    const connection = await getMetaConnectionForNumber(workspaceId, phoneNumberId);
    if (!connection) return fail("That WhatsApp number is not connected to this workspace", 409);

    const templates = await new MetaGraphClient(connection.accessToken).getTemplates(connection.wabaId);
    const template = templates.find((item) => item.name === templateName && item.language === templateLanguage);
    if (!template) return fail("Template was not found on this WhatsApp account", 404);
    const inspection = inspectTemplate(template);
    if (!inspection.ok) return fail(inspection.reason, 422);
    if (inspection.bodyVariables !== templateVariables.length) {
      return fail(`This template needs ${inspection.bodyVariables} variable value(s)`, 422);
    }

    const audience = await countAudience(workspaceId, audienceTag);
    if (audience.optedIn === 0) {
      return fail("No contacts in this audience have opted in to marketing messages", 422);
    }

    const campaign = await createCampaign({
      id, workspaceId, name, phoneNumberId, wabaId: connection.wabaId, templateName, templateLanguage,
      templateVariables, audienceTag, authUserId: auth.session.userId,
    });
    if (!campaign) return fail("That campaign id is already in use", 409);
    return NextResponse.json({ data: campaign }, { status: 201, headers: noStore });
  } catch (error) {
    console.error("[Campaign Create Error]", error);
    return fail("The campaign could not be created. Please try again.", 503);
  }
}

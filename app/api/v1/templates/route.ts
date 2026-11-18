import { NextRequest, NextResponse } from "next/server";
import { apiError, withApiKey } from "@/lib/developer/api-gateway";
import { getMetaConnectionForWorkspace } from "@/lib/meta/connections";
import { MetaGraphClient } from "@/lib/meta/client";

/**
 * GET /api/v1/templates?status=APPROVED
 * Lists message templates for the workspace's WhatsApp Business Account, read live from Meta.
 * Send an approved template with POST /api/v1/messages.
 */
export async function GET(request: NextRequest) {
  return withApiKey(request, async (context) => {
    const statusFilter = (context.request.nextUrl.searchParams.get("status") || "").trim().toUpperCase();

    let connection;
    try {
      connection = await getMetaConnectionForWorkspace(context.workspaceId);
    } catch (error) {
      console.error("[Developer API Templates] No usable WhatsApp connection", error);
      return apiError(409, "conflict", "No connected WhatsApp Business Account is available for this workspace.");
    }

    const templates = await new MetaGraphClient(connection.accessToken).getTemplates(connection.wabaId);
    const data = (templates as Array<Record<string, unknown>>)
      .filter((template) => !statusFilter || String(template.status || "").toUpperCase() === statusFilter)
      .map((template) => ({
        name: template.name,
        language: template.language,
        category: template.category ?? null,
        status: template.status ?? null,
      }));
    return NextResponse.json({ data });
  });
}

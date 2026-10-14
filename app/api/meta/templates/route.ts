import { NextRequest, NextResponse } from "next/server";
import { MessageTemplate } from "@/types/strapi";
import { requireApiSession } from "@/lib/auth/session";
import { StrapiClient } from "@/lib/strapi/client";
import { getMetaConnectionForWorkspace } from "@/lib/meta/connections";
import { MetaGraphClient } from "@/lib/meta/client";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin"]);
    if (!auth.ok) return auth.response;
    const body = await request.json();
    const { name, language = "en_US", category, components } = body;

    if (!name || !category || !components) {
      return NextResponse.json(
        { error: "Missing required fields: name, category, components" },
        { status: 400 }
      );
    }

    const normalizedName = name.toLowerCase().trim().replace(/[^a-z0-9_]+/g, "_");
    const connection = await getMetaConnectionForWorkspace(auth.session.tenantId);
    const meta = new MetaGraphClient(connection.accessToken);
    const metaTemplate = await meta.createTemplate(connection.wabaId, {
      name: normalizedName,
      language,
      category,
      components,
    });

    const template: Omit<MessageTemplate, "id"> = {
      metaTemplateId: metaTemplate.id,
      name: normalizedName,
      language,
      category: (metaTemplate.category || category) as MessageTemplate["category"],
      status: (metaTemplate.status || "PENDING") as MessageTemplate["status"],
      components,
    };

    const strapiClient = new StrapiClient(auth.session.tenantId);
    const createdTemplate = await strapiClient.createTemplate(template);

    return NextResponse.json({
      success: true,
      message: "Template submitted to Meta. Approval status will update from Meta webhooks.",
      data: createdTemplate,
    });
  } catch (error: any) {
    console.error("[Template Creation Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit template to Meta" },
      { status: 500 }
    );
  }
}

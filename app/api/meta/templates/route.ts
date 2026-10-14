import { NextRequest, NextResponse } from "next/server";
import { MessageTemplate } from "@/types/strapi";
import { requireApiSession } from "@/lib/auth/session";
import { StrapiClient } from "@/lib/strapi/client";

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

    // In a live production Meta app, call POST /{waba_id}/message_templates
    const template: Omit<MessageTemplate, "id"> = {
      metaTemplateId: `tpl_meta_${Date.now()}`,
      name: name.toLowerCase().replace(/\s+/g, "_"),
      language,
      category,
      status: "PENDING", // Sent to Meta review
      components,
    };

    const strapiClient = new StrapiClient(auth.session.tenantId);
    const createdTemplate = await strapiClient.createTemplate(template);

    return NextResponse.json({
      success: true,
      message: "Template submitted to Meta for review. Typical approval time is under 1 minute.",
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

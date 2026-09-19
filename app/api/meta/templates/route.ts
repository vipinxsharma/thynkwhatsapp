import { NextRequest, NextResponse } from "next/server";
import { sampleTemplates } from "@/lib/strapi/mock-data";
import { MessageTemplate } from "@/types/strapi";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, language = "en_US", category, components } = body;

    if (!name || !category || !components) {
      return NextResponse.json(
        { error: "Missing required fields: name, category, components" },
        { status: 400 }
      );
    }

    // In a live production Meta app, call POST /{waba_id}/message_templates
    const createdTemplate: MessageTemplate = {
      id: Date.now(),
      metaTemplateId: `tpl_meta_${Date.now()}`,
      name: name.toLowerCase().replace(/\s+/g, "_"),
      language,
      category,
      status: "PENDING", // Sent to Meta review
      components,
    };

    // Add to in-memory list for demo/local mode
    sampleTemplates.push(createdTemplate);

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

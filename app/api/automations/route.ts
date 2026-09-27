import { NextRequest, NextResponse } from "next/server";
import { AutomationEngine } from "@/lib/automations/rules";

export async function GET() {
  try {
    const rules = AutomationEngine.getRules();
    return NextResponse.json({ success: true, data: rules });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load automation rules" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if test simulation action
    if (body.action === "test") {
      const { text } = body;
      const matched = AutomationEngine.matchRule(text || "");
      return NextResponse.json({
        success: true,
        matched: !!matched,
        rule: matched,
      });
    }

    const {
      name,
      description,
      triggerType = "contains_keyword",
      keywords = [],
      responseType = "text",
      replyText,
      interactiveButtons,
      assignTags,
      setConversationStatus,
    } = body;

    if (!name || !replyText || !keywords.length) {
      return NextResponse.json(
        { error: "Name, reply text, and at least one keyword are required" },
        { status: 400 }
      );
    }

    const newRule = AutomationEngine.addRule({
      name,
      description: description || "",
      triggerType,
      keywords,
      responseType,
      replyText,
      interactiveButtons,
      assignTags,
      setConversationStatus,
      enabled: true,
    });

    return NextResponse.json({ success: true, data: newRule });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to save automation rule" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, toggle, updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Rule ID is required" }, { status: 400 });
    }

    let result;
    if (toggle) {
      result = AutomationEngine.toggleRule(id);
    } else {
      result = AutomationEngine.updateRule(id, updates || {});
    }

    if (!result) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update automation rule" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Rule ID is required" }, { status: 400 });
    }

    const deleted = AutomationEngine.deleteRule(id);
    return NextResponse.json({ success: deleted });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete automation rule" },
      { status: 500 }
    );
  }
}

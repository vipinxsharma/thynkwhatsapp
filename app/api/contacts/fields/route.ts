import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { isDurableInboxEnabled } from "@/lib/strapi/client";
import {
  DURABLE_REQUIRED_MESSAGE,
  isUuid,
  validateChoices,
  validateFieldDefinitionInput,
} from "@/lib/contacts/validation";
import {
  createContactFieldDefinition,
  deleteContactFieldDefinition,
  isUniqueViolation,
  listContactFieldDefinitions,
  updateContactFieldDefinition,
} from "@/lib/contacts/store";

const DUPLICATE_FIELD = "A custom field with this name already exists";
const FIELD_LIMIT = "This workspace has reached the limit of 100 custom fields";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiSession(request);
    if (!auth.ok) return auth.response;
    if (!isDurableInboxEnabled()) return NextResponse.json({ success: true, data: [] });
    const data = await listContactFieldDefinitions(auth.session.tenantId);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load custom fields" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin"]);
    if (!auth.ok) return auth.response;
    if (!isDurableInboxEnabled()) {
      return NextResponse.json({ error: DURABLE_REQUIRED_MESSAGE }, { status: 503 });
    }

    const body = await request.json();
    const input = validateFieldDefinitionInput(body || {});
    if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

    try {
      const definition = await createContactFieldDefinition(auth.session.tenantId, input.value);
      if (!definition) return NextResponse.json({ error: FIELD_LIMIT }, { status: 409 });
      return NextResponse.json({ success: true, data: definition });
    } catch (error) {
      if (isUniqueViolation(error)) return NextResponse.json({ error: DUPLICATE_FIELD }, { status: 409 });
      throw error;
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create custom field" }, { status: 500 });
  }
}

/** Only the label and choice options can change. The key and type stay fixed so stored values keep their meaning. */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin"]);
    if (!auth.ok) return auth.response;
    if (!isDurableInboxEnabled()) {
      return NextResponse.json({ error: DURABLE_REQUIRED_MESSAGE }, { status: 503 });
    }

    const body = await request.json();
    if (!isUuid(body?.id)) return NextResponse.json({ error: "Field ID is required" }, { status: 400 });
    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (!label || label.length > 80) {
      return NextResponse.json({ error: "Field name must be 1 to 80 characters" }, { status: 400 });
    }

    let choices: string[] | null = null;
    if (body.choices !== undefined) {
      const result = validateChoices(body.choices);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      choices = result.value;
    }

    const definition = await updateContactFieldDefinition(auth.session.tenantId, body.id, { label, choices });
    if (!definition) return NextResponse.json({ error: "Custom field not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: definition });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update custom field" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin"]);
    if (!auth.ok) return auth.response;
    if (!isDurableInboxEnabled()) {
      return NextResponse.json({ error: DURABLE_REQUIRED_MESSAGE }, { status: 503 });
    }

    const id = new URL(request.url).searchParams.get("id");
    if (!isUuid(id)) return NextResponse.json({ error: "Field ID is required" }, { status: 400 });

    const deleted = await deleteContactFieldDefinition(auth.session.tenantId, id);
    if (!deleted) return NextResponse.json({ error: "Custom field not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete custom field" }, { status: 500 });
  }
}

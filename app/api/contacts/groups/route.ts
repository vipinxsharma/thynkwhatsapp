import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { isDurableInboxEnabled } from "@/lib/strapi/client";
import { DURABLE_REQUIRED_MESSAGE, isUuid, validateGroupName } from "@/lib/contacts/validation";
import {
  createContactGroup,
  deleteContactGroup,
  isUniqueViolation,
  listContactGroups,
  renameContactGroup,
} from "@/lib/contacts/store";

const DUPLICATE_GROUP = "A group with this name already exists";

function unavailable() {
  return NextResponse.json({ error: DURABLE_REQUIRED_MESSAGE }, { status: 503 });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiSession(request);
    if (!auth.ok) return auth.response;
    if (!isDurableInboxEnabled()) return NextResponse.json({ success: true, data: [] });
    const data = await listContactGroups(auth.session.tenantId);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load groups" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
    if (!auth.ok) return auth.response;
    if (!isDurableInboxEnabled()) return unavailable();

    const body = await request.json();
    const name = validateGroupName(body?.name);
    if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });

    try {
      const group = await createContactGroup(auth.session.tenantId, auth.session.userId, name.value);
      return NextResponse.json({ success: true, data: group });
    } catch (error) {
      if (isUniqueViolation(error)) return NextResponse.json({ error: DUPLICATE_GROUP }, { status: 409 });
      throw error;
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create group" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin"]);
    if (!auth.ok) return auth.response;
    if (!isDurableInboxEnabled()) return unavailable();

    const body = await request.json();
    if (!isUuid(body?.id)) return NextResponse.json({ error: "Group ID is required" }, { status: 400 });
    const name = validateGroupName(body?.name);
    if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });

    try {
      const group = await renameContactGroup(auth.session.tenantId, body.id, name.value);
      if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
      return NextResponse.json({ success: true, data: group });
    } catch (error) {
      if (isUniqueViolation(error)) return NextResponse.json({ error: DUPLICATE_GROUP }, { status: 409 });
      throw error;
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to rename group" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin"]);
    if (!auth.ok) return auth.response;
    if (!isDurableInboxEnabled()) return unavailable();

    const id = new URL(request.url).searchParams.get("id");
    if (!isUuid(id)) return NextResponse.json({ error: "Group ID is required" }, { status: 400 });

    const deleted = await deleteContactGroup(auth.session.tenantId, id);
    if (!deleted) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete group" }, { status: 500 });
  }
}

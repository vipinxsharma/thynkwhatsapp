import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { isDurableInboxEnabled } from "@/lib/strapi/client";
import { DURABLE_REQUIRED_MESSAGE, isUuid, validateUuidList } from "@/lib/contacts/validation";
import { addContactsToGroup, removeContactFromGroup } from "@/lib/contacts/store";

const MAX_BULK_MEMBERS = 500;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
    if (!auth.ok) return auth.response;
    if (!isDurableInboxEnabled()) {
      return NextResponse.json({ error: DURABLE_REQUIRED_MESSAGE }, { status: 503 });
    }

    const body = await request.json();
    if (!isUuid(body?.groupId)) return NextResponse.json({ error: "groupId is required" }, { status: 400 });
    const contactIds = validateUuidList(body?.contactIds, MAX_BULK_MEMBERS, "contactIds");
    if (!contactIds.ok) return NextResponse.json({ error: contactIds.error }, { status: 400 });

    const added = await addContactsToGroup(auth.session.tenantId, body.groupId, contactIds.value);
    return NextResponse.json({ success: true, data: { added } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to add contacts to group" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
    if (!auth.ok) return auth.response;
    if (!isDurableInboxEnabled()) {
      return NextResponse.json({ error: DURABLE_REQUIRED_MESSAGE }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId");
    const contactId = searchParams.get("contactId");
    if (!isUuid(groupId) || !isUuid(contactId)) {
      return NextResponse.json({ error: "groupId and contactId are required" }, { status: 400 });
    }

    const removed = await removeContactFromGroup(auth.session.tenantId, groupId, contactId);
    return NextResponse.json({ success: removed });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to remove contact from group" }, { status: 500 });
  }
}

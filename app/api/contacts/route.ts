import { NextRequest, NextResponse } from "next/server";
import { StrapiClient, isDurableInboxEnabled } from "@/lib/strapi/client";
import { requireApiSession } from "@/lib/auth/session";
import {
  isConsentStatus,
  isUuid,
  normalizeContactPhone,
  parseIntParam,
  validateContactName,
  validateCustomAttributes,
  validateUuidList,
  type FieldDefinition,
} from "@/lib/contacts/validation";
import {
  listContactFieldDefinitions,
  listContactTags,
  listContactsPage,
  setContactGroups,
  type ContactListRow,
} from "@/lib/contacts/store";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_GROUPS_PER_CONTACT = 50;

function withoutNulls(values: Record<string, string | number | null>): Record<string, string | number> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null)) as Record<string, string | number>;
}

async function fieldDefinitionsFor(workspaceId: string): Promise<FieldDefinition[]> {
  return isDurableInboxEnabled() ? listContactFieldDefinitions(workspaceId) : [];
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiSession(request);
    if (!auth.ok) return auth.response;
    const workspaceId = auth.session.tenantId;

    const { searchParams } = new URL(request.url);
    const page = parseIntParam(searchParams.get("page"), 1, 100000);
    const pageSize = parseIntParam(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    if (page === null || pageSize === null) {
      return NextResponse.json({ error: "page and pageSize must be positive whole numbers" }, { status: 400 });
    }
    const search = (searchParams.get("search") || "").trim().slice(0, 100);
    const tag = (searchParams.get("tag") || "").trim().slice(0, 80);
    const groupId = searchParams.get("group") || "";
    const consent = searchParams.get("consent") || "all";
    if (groupId && !isUuid(groupId)) {
      return NextResponse.json({ error: "group must be a valid group ID" }, { status: 400 });
    }
    if (consent !== "all" && !isConsentStatus(consent)) {
      return NextResponse.json({ error: "consent must be all, subscribed or unsubscribed" }, { status: 400 });
    }

    let contacts: ContactListRow[];
    let total: number;
    let tags: string[];

    if (isDurableInboxEnabled()) {
      const [result, tagList] = await Promise.all([
        listContactsPage(workspaceId, {
          page,
          pageSize,
          search,
          tag: tag && tag !== "all" ? tag : undefined,
          groupId: groupId || undefined,
          consent: consent as "all" | "subscribed" | "unsubscribed",
        }),
        listContactTags(workspaceId),
      ]);
      contacts = result.contacts;
      total = result.total;
      tags = tagList;
    } else {
      // In-memory demo data: same filters, applied in memory. No demo contact belongs to a group.
      const strapiClient = new StrapiClient(workspaceId);
      const conversations = await strapiClient.getConversations();
      const all = conversations.map((c) => ({
        ...c.contact,
        consentStatus: c.contact.consentStatus ?? "subscribed",
        consentUpdatedAt: null,
        groupIds: [] as string[],
        conversationId: c.id,
        windowExpiresAt: c.windowExpiresAt,
        lastMessageAt: c.lastMessageAt,
        unreadCount: c.unreadCount,
      })) as unknown as ContactListRow[];

      tags = Array.from(new Set(all.flatMap((c) => c.tags || []))).sort();
      const filtered = all.filter((c) => {
        if (search) {
          const needle = search.toLowerCase();
          const matches =
            c.name.toLowerCase().includes(needle) ||
            c.phoneNumber.includes(search) ||
            String(c.customAttributes?.company || "").toLowerCase().includes(needle);
          if (!matches) return false;
        }
        if (tag && tag !== "all" && !(c.tags || []).includes(tag)) return false;
        if (groupId) return false;
        if (consent !== "all" && c.consentStatus !== consent) return false;
        return true;
      });
      total = filtered.length;
      contacts = filtered.slice((page - 1) * pageSize, page * pageSize);
    }

    return NextResponse.json({
      success: true,
      data: contacts,
      tags,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
    if (!auth.ok) return auth.response;
    const workspaceId = auth.session.tenantId;
    const strapiClient = new StrapiClient(workspaceId);

    const body = await request.json();
    const { name, phoneNumber, tags, company, customAttributes, groupIds } = body;

    if (!name || !phoneNumber) {
      return NextResponse.json(
        { error: "Name and Phone Number are required" },
        { status: 400 }
      );
    }
    const nameResult = validateContactName(name);
    if (!nameResult.ok) return NextResponse.json({ error: nameResult.error }, { status: 400 });
    const phone = normalizeContactPhone(phoneNumber);
    if (!phone.ok) return NextResponse.json({ error: phone.error }, { status: 400 });

    const groups = groupIds === undefined ? { ok: true as const, value: [] as string[] } : validateUuidList(groupIds, MAX_GROUPS_PER_CONTACT, "groupIds");
    if (!groups.ok) return NextResponse.json({ error: groups.error }, { status: 400 });

    const definitions = await fieldDefinitionsFor(workspaceId);
    const attributes = validateCustomAttributes(definitions, {
      ...(company ? { company } : {}),
      ...(customAttributes || {}),
    });
    if (!attributes.ok) return NextResponse.json({ error: attributes.error }, { status: 400 });

    const { contact, conversation } = await strapiClient.createContact({
      name: nameResult.value,
      phoneNumber: phone.value.phoneNumber,
      tags: tags || ["New Contact"],
      customAttributes: withoutNulls(attributes.value),
    });

    if (isDurableInboxEnabled() && groups.value.length) {
      await setContactGroups(workspaceId, String(contact.id), groups.value);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...contact,
        groupIds: isDurableInboxEnabled() ? groups.value : [],
        conversationId: conversation.id,
        windowExpiresAt: conversation.windowExpiresAt,
        lastMessageAt: conversation.lastMessageAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create contact" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
    if (!auth.ok) return auth.response;
    const workspaceId = auth.session.tenantId;
    const strapiClient = new StrapiClient(workspaceId);

    const body = await request.json();
    const { id, name, phoneNumber, tags, company, customAttributes, groupIds } = body;

    if (!id) {
      return NextResponse.json({ error: "Contact ID is required" }, { status: 400 });
    }

    let nameUpdate: string | undefined;
    if (name) {
      const nameResult = validateContactName(name);
      if (!nameResult.ok) return NextResponse.json({ error: nameResult.error }, { status: 400 });
      nameUpdate = nameResult.value;
    }

    let phoneUpdate: { phoneNumber: string; waId: string } | undefined;
    if (phoneNumber) {
      const phone = normalizeContactPhone(phoneNumber);
      if (!phone.ok) return NextResponse.json({ error: phone.error }, { status: 400 });
      phoneUpdate = phone.value;
    }

    const groups = groupIds === undefined ? undefined : validateUuidList(groupIds, MAX_GROUPS_PER_CONTACT, "groupIds");
    if (groups && !groups.ok) return NextResponse.json({ error: groups.error }, { status: 400 });

    const definitions = await fieldDefinitionsFor(workspaceId);
    // A company field that was emptied is sent as "" and clears the stored value.
    const attributes = validateCustomAttributes(definitions, {
      ...(company !== undefined ? { company: company || null } : {}),
      ...(customAttributes || {}),
    });
    if (!attributes.ok) return NextResponse.json({ error: attributes.error }, { status: 400 });

    const updated = await strapiClient.updateContact(id, {
      ...(nameUpdate ? { name: nameUpdate } : {}),
      ...(phoneUpdate ? phoneUpdate : {}),
      ...(tags ? { tags } : {}),
      customAttributes: attributes.value as Record<string, any>,
    });

    if (!updated) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    if (isDurableInboxEnabled() && groups?.ok) {
      await setContactGroups(workspaceId, String(id), groups.value);
    }

    return NextResponse.json({
      success: true,
      data: { ...updated, ...(groups?.ok ? { groupIds: isDurableInboxEnabled() ? groups.value : [] } : {}) },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update contact" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
    if (!auth.ok) return auth.response;
    const strapiClient = new StrapiClient(auth.session.tenantId);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Contact ID is required" }, { status: 400 });
    }

    const deleted = await strapiClient.deleteContact(id);
    return NextResponse.json({ success: deleted });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete contact" },
      { status: 500 }
    );
  }
}

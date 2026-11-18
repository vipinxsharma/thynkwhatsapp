import { NextRequest, NextResponse } from "next/server";
import { StrapiClient, isDurableInboxEnabled } from "@/lib/strapi/client";
import { ensureContactConversation, updateContact } from "@/lib/inbox/store";
import { requireApiSession } from "@/lib/auth/session";
import {
  isUuid,
  normalizeContactPhone,
  validateContactName,
  validateCustomAttributes,
  type FieldDefinition,
} from "@/lib/contacts/validation";
import {
  addContactsToGroup,
  findOrCreateContactGroupByName,
  listContactFieldDefinitions,
} from "@/lib/contacts/store";

const MAX_ROWS_PER_REQUEST = 500;
const MAX_REPORTED_ERRORS = 50;

type ImportRowInput = {
  name?: unknown;
  phoneNumber?: unknown;
  tags?: unknown;
  customAttributes?: unknown;
  groupName?: unknown;
};

function cleanTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return ["Imported CSV"];
  const tags = raw
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 20);
  return tags.length ? tags : ["Imported CSV"];
}

function withoutNulls(values: Record<string, string | number | null>): Record<string, string | number> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null)) as Record<string, string | number>;
}

/**
 * Bulk CSV import. Rows are validated on the server again, even though the modal already mapped them.
 * Existing contacts (same phone number) are not renamed or re-numbered; their custom attributes are merged
 * and they are added to the chosen group.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin"]);
    if (!auth.ok) return auth.response;
    const workspaceId = auth.session.tenantId;
    const durable = isDurableInboxEnabled();

    const body = await request.json();
    const { contacts, groupId } = body ?? {};

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { error: "No contacts provided for bulk import" },
        { status: 400 }
      );
    }
    if (contacts.length > MAX_ROWS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Import at most ${MAX_ROWS_PER_REQUEST} rows per request` },
        { status: 400 }
      );
    }
    if (groupId !== undefined && groupId !== null && !isUuid(groupId)) {
      return NextResponse.json({ error: "groupId must be a valid group ID" }, { status: 400 });
    }

    const definitions: FieldDefinition[] = durable ? await listContactFieldDefinitions(workspaceId) : [];
    const strapiClient = new StrapiClient(workspaceId);
    const existingWaIds = durable ? new Set<string>() : new Set((await strapiClient.getContacts()).map((c) => c.waId));
    const groupIdByName = new Map<string, string>();
    const warnings: string[] = [];

    let created = 0;
    let existing = 0;
    let invalid = 0;
    const errors: Array<{ row: number; message: string }> = [];
    const reject = (row: number, message: string) => {
      invalid++;
      if (errors.length < MAX_REPORTED_ERRORS) errors.push({ row, message });
    };

    for (let index = 0; index < contacts.length; index++) {
      const row = index + 1;
      const raw = (contacts[index] ?? {}) as ImportRowInput;

      const name = validateContactName(raw.name);
      if (!name.ok) {
        reject(row, name.error);
        continue;
      }
      const phone = normalizeContactPhone(raw.phoneNumber);
      if (!phone.ok) {
        reject(row, phone.error);
        continue;
      }
      const attributes = validateCustomAttributes(definitions, raw.customAttributes);
      if (!attributes.ok) {
        reject(row, attributes.error);
        continue;
      }
      const values = withoutNulls(attributes.value);
      const groupName = typeof raw.groupName === "string" ? raw.groupName.trim().slice(0, 80) : "";

      if (!durable) {
        // In-memory demo data has no groups, so group targets are reported once below.
        if (groupId || groupName) warnings.push("Groups were not assigned: contact groups need INBOX_STORAGE=postgres.");
        if (existingWaIds.has(phone.value.waId)) {
          existing++;
          continue;
        }
        await strapiClient.createContact({
          name: name.value,
          phoneNumber: phone.value.phoneNumber,
          tags: cleanTags(raw.tags),
          customAttributes: values,
        });
        existingWaIds.add(phone.value.waId);
        created++;
        continue;
      }

      const result = await ensureContactConversation({
        workspaceId,
        name: name.value,
        phoneNumber: phone.value.phoneNumber,
        tags: cleanTags(raw.tags),
        customAttributes: values,
      });
      const contactId = String(result.contact.id);
      if (result.created) {
        created++;
      } else {
        existing++;
        if (Object.keys(values).length) {
          await updateContact(workspaceId, contactId, { customAttributes: values });
        }
      }

      const targets: string[] = [];
      if (groupId) targets.push(groupId);
      if (groupName) {
        const cacheKey = groupName.toLowerCase();
        let resolved = groupIdByName.get(cacheKey);
        if (!resolved) {
          const group = await findOrCreateContactGroupByName(workspaceId, auth.session.userId, groupName);
          resolved = group.id;
          groupIdByName.set(cacheKey, resolved);
        }
        targets.push(resolved);
      }
      for (const target of new Set(targets)) {
        await addContactsToGroup(workspaceId, target, [contactId]);
      }
    }

    const message = `Imported ${created} contacts. Skipped ${existing + invalid} (${existing} already existed, ${invalid} invalid).`;
    return NextResponse.json({
      success: true,
      message,
      data: {
        created,
        skipped: existing + invalid,
        existing,
        invalid,
        errors,
        warnings: Array.from(new Set(warnings)),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to bulk import contacts" },
      { status: 500 }
    );
  }
}

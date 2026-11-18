import { NextRequest, NextResponse } from "next/server";
import { apiError, readJsonObject, withApiKey } from "@/lib/developer/api-gateway";
import { listContactsPage } from "@/lib/developer/contacts";
import {
  decodeContactCursor,
  encodeContactCursor,
  parseContactInput,
  parseLimit,
} from "@/lib/developer/validation";
import { upsertContactByPhone } from "@/lib/inbox/store";
import { isDurableInboxEnabled } from "@/lib/strapi/client";

/** GET /api/v1/contacts?limit=50&cursor=... Lists contacts oldest first. Pass nextCursor back as cursor. */
export async function GET(request: NextRequest) {
  return withApiKey(request, async (context) => {
    const limit = parseLimit(context.request.nextUrl.searchParams.get("limit"));
    if (!limit.ok) return apiError(400, "invalid_request", limit.error);
    const cursor = decodeContactCursor(context.request.nextUrl.searchParams.get("cursor") || "");
    if (!cursor.ok) return apiError(400, "invalid_request", cursor.error);
    if (!isDurableInboxEnabled()) return apiError(503, "unavailable", "Contact storage is not configured on this server.");

    const rows = await listContactsPage({
      workspaceId: context.workspaceId,
      limit: limit.value + 1,
      after: cursor.value,
    });
    const page = rows.slice(0, limit.value);
    const last = page[page.length - 1];
    return NextResponse.json({
      data: page,
      nextCursor: rows.length > limit.value && last ? encodeContactCursor(last.createdAt, last.id) : null,
    });
  });
}

/**
 * POST /api/v1/contacts
 * Upserts a contact by phone number. Returns 201 when the contact is new and 200 when it existed.
 */
export async function POST(request: NextRequest) {
  return withApiKey(request, async (context) => {
    const body = await readJsonObject(context.request);
    if (!body) return apiError(400, "invalid_json", "Request body must be a JSON object");
    const parsed = parseContactInput(body);
    if (!parsed.ok) return apiError(400, "invalid_request", parsed.error);
    if (!isDurableInboxEnabled()) return apiError(503, "unavailable", "Contact storage is not configured on this server.");

    const result = await upsertContactByPhone({
      workspaceId: context.workspaceId,
      phoneNumber: `+${parsed.value.phoneNumber}`,
      name: parsed.value.name,
      tags: parsed.value.tags,
      customAttributes: parsed.value.customAttributes,
    });
    return NextResponse.json({ data: result.contact }, { status: result.created ? 201 : 200 });
  });
}

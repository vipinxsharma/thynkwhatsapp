import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { isDurableInboxEnabled } from "@/lib/strapi/client";
import { DURABLE_REQUIRED_MESSAGE, isConsentStatus, validateUuidList } from "@/lib/contacts/validation";
import { setContactConsent } from "@/lib/contacts/store";

const MAX_BULK_CONSENT = 500;

/**
 * Records opt-in or opt-out state for contacts. Unsubscribing a contact sets it to "unsubscribed".
 * Each change is written to the audit log.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
    if (!auth.ok) return auth.response;
    if (!isDurableInboxEnabled()) {
      return NextResponse.json({ error: DURABLE_REQUIRED_MESSAGE }, { status: 503 });
    }

    const body = await request.json();
    const contactIds = validateUuidList(body?.contactIds, MAX_BULK_CONSENT, "contactIds");
    if (!contactIds.ok || contactIds.value.length === 0) {
      return NextResponse.json({ error: contactIds.ok ? "Select at least one contact" : contactIds.error }, { status: 400 });
    }
    if (!isConsentStatus(body?.status)) {
      return NextResponse.json({ error: "status must be subscribed or unsubscribed" }, { status: 400 });
    }

    const updated = await setContactConsent(auth.session.tenantId, auth.session.userId, contactIds.value, body.status);
    return NextResponse.json({ success: true, data: { updated, status: body.status } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update consent" }, { status: 500 });
  }
}

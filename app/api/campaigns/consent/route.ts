import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { campaignAccessBlock } from "@/lib/campaigns/access";
import { listConsentContacts, setMarketingConsent } from "@/lib/campaigns/store";

const noStore = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  const blocked = await campaignAccessBlock(auth.session.tenantId, false);
  if (blocked) return blocked;
  try {
    return NextResponse.json({ data: await listConsentContacts(auth.session.tenantId) }, { headers: noStore });
  } catch (error) {
    console.error("[Consent List Error]", error);
    return NextResponse.json({ error: "Contacts are temporarily unavailable" }, { status: 503, headers: noStore });
  }
}

/**
 * Records marketing consent. Opting contacts in requires the caller to confirm
 * that those people agreed to receive marketing messages from the business.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const blocked = await campaignAccessBlock(auth.session.tenantId, false);
  if (blocked) return blocked;
  const body = await request.json().catch(() => null);
  const status = body?.status;
  const contactIds: unknown[] = Array.isArray(body?.contactIds) ? body.contactIds : [];
  if (status !== "opted_in" && status !== "opted_out") {
    return NextResponse.json({ error: "Status must be opted_in or opted_out" }, { status: 400, headers: noStore });
  }
  if (contactIds.length < 1 || contactIds.length > 1000 || !contactIds.every((id) => typeof id === "string" && UUID.test(id))) {
    return NextResponse.json({ error: "Select between 1 and 1000 contacts" }, { status: 400, headers: noStore });
  }
  if (status === "opted_in" && body?.confirmed !== true) {
    return NextResponse.json(
      { error: "Confirm that these contacts agreed to receive marketing messages" },
      { status: 400, headers: noStore }
    );
  }
  try {
    const updated = await setMarketingConsent({
      workspaceId: auth.session.tenantId, contactIds: contactIds as string[], status, authUserId: auth.session.userId,
    });
    return NextResponse.json({ data: { updated } }, { headers: noStore });
  } catch (error) {
    console.error("[Consent Update Error]", error);
    return NextResponse.json({ error: "Consent could not be saved. Please try again." }, { status: 503, headers: noStore });
  }
}

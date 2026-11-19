import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { selectableTemplates } from "@/components/campaigns/campaign-helpers";
import { StrapiClient } from "@/lib/strapi/client";

const noStore = { "Cache-Control": "no-store" };

/**
 * Lists the approved templates a campaign can use (approved, and fillable by the
 * sender). Read from the synced template cache; the create route re-checks with Meta.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  try {
    const templates = await new StrapiClient(auth.session.tenantId).getTemplates();
    return NextResponse.json({ data: selectableTemplates(templates) }, { headers: noStore });
  } catch (error) {
    console.error("[Campaign Templates Error]", error);
    return NextResponse.json({ error: "Templates are temporarily unavailable" }, { status: 503, headers: noStore });
  }
}

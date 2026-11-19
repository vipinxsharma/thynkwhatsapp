import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { getPartnerAccess, requestPartnerAccess } from "@/lib/partner/access";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ data: await getPartnerAccess(auth.session.tenantId) }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Partner access is temporarily unavailable" }, { status: 503, headers: noStore });
  }
}

/** A workspace owner or admin requests partner features. A platform superadmin must approve. */
export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ data: await requestPartnerAccess(auth.session.tenantId, auth.session.userId) }, { headers: noStore });
  } catch (error) {
    console.error("[Partner Request Error]", error);
    return NextResponse.json({ error: "The request could not be saved. Please try again." }, { status: 503, headers: noStore });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { isPlatformSuperadmin } from "@/lib/auth/platform-admin";
import { decidePartnerAccess, listPendingPartnerRequests } from "@/lib/partner/access";

const noStore = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Platform superadmins only: the pending partner requests. */
export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  if (!(await isPlatformSuperadmin(auth.session))) {
    return NextResponse.json({ error: "Platform administrators only" }, { status: 403, headers: noStore });
  }
  return NextResponse.json({ data: await listPendingPartnerRequests() }, { headers: noStore });
}

/** Platform superadmins only: approve, reject, or assign partner access for a workspace. */
export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  if (!(await isPlatformSuperadmin(auth.session))) {
    return NextResponse.json({ error: "Platform administrators only" }, { status: 403, headers: noStore });
  }
  const body = await request.json().catch(() => null);
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : "";
  const decision = body?.decision;
  if (!UUID.test(workspaceId)) return NextResponse.json({ error: "A workspace id is required" }, { status: 400, headers: noStore });
  if (!["approved", "rejected", "assigned"].includes(decision)) {
    return NextResponse.json({ error: "Decision must be approved, rejected or assigned" }, { status: 400, headers: noStore });
  }
  try {
    const access = await decidePartnerAccess({ workspaceId, decision, superadminAuthUserId: auth.session.userId });
    return NextResponse.json({ data: access }, { headers: noStore });
  } catch (error) {
    console.error("[Partner Decision Error]", error);
    return NextResponse.json({ error: "The decision could not be saved. Please try again." }, { status: 503, headers: noStore });
  }
}

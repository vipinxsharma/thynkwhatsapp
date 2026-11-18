import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { isCrmCode } from "@/lib/crm/options";
import { getCrmChoice, saveCrmChoice } from "@/lib/crm/store";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ data: await getCrmChoice(auth.session.tenantId) }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "CRM choice is temporarily unavailable" }, { status: 503, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null);
  if (!isCrmCode(body?.crmCode)) {
    return NextResponse.json({ error: "Choose Coldcall.in or SuperCRM" }, { status: 400, headers: noStore });
  }
  try {
    const saved = await saveCrmChoice({
      workspaceId: auth.session.tenantId,
      crmCode: body.crmCode,
      authUserId: auth.session.userId,
      contactEmail: auth.session.email,
    });
    if (saved.crmCode !== body.crmCode) {
      return NextResponse.json(
        { error: "Your CRM access is already set up. Contact support to change it.", data: saved },
        { status: 409, headers: noStore }
      );
    }
    return NextResponse.json({ data: saved }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "CRM choice could not be saved. Please try again." }, { status: 503, headers: noStore });
  }
}

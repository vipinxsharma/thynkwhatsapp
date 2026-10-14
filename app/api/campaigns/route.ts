import { NextRequest, NextResponse } from "next/server";
import { CampaignStore } from "@/lib/campaigns/store";
import { requireApiSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiSession(request);
    if (!auth.ok) return auth.response;
    const campaigns = CampaignStore.getAll(auth.session.tenantId);
    return NextResponse.json({ success: true, data: campaigns });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

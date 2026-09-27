import { NextResponse } from "next/server";
import { CampaignStore } from "@/lib/campaigns/store";

export async function GET() {
  try {
    const campaigns = CampaignStore.getAll();
    return NextResponse.json({ success: true, data: campaigns });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

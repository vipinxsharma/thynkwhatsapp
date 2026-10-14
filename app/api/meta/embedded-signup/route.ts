import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";

interface EmbeddedSignupRequestBody {
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
}

/**
 * Handles the OAuth authorization code returned by Meta Embedded Signup popup
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin"]);
    if (!auth.ok) return auth.response;
    const body: EmbeddedSignupRequestBody = await request.json();
    const { code, wabaId, phoneNumberId } = body;
    if (!code || !wabaId || !phoneNumberId) {
      return NextResponse.json(
        { error: "Authorization code, WABA ID, and phone number ID are required" },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(wabaId) || !/^\d+$/.test(phoneNumberId)) {
      return NextResponse.json({ error: "Invalid Meta account identifiers" }, { status: 400 });
    }

    // Do not consume a one-time Meta authorization code until the durable tenant-owned
    // credential store exists. The previous implementation returned a mock success and
    // discarded the encrypted credential, leaving the WABA unusable after onboarding.
    return NextResponse.json({
      error: "Durable tenant-scoped Meta onboarding is not enabled yet",
      next: "Implement encrypted credential persistence and WABA ownership verification before code exchange",
    }, { status: 501 });
  } catch (error: any) {
    console.error("[Embedded Signup Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to process Meta Embedded Signup" },
      { status: 500 }
    );
  }
}

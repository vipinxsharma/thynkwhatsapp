import { NextRequest, NextResponse } from "next/server";
import { StrapiClient } from "@/lib/strapi/client";
import { requireApiSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin"]);
    if (!auth.ok) return auth.response;
    const strapiClient = new StrapiClient(auth.session.tenantId);

    const body = await request.json();
    const { contacts } = body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { error: "No contacts provided for bulk import" },
        { status: 400 }
      );
    }

    const result = await strapiClient.bulkImportContacts(contacts);

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${result.created} contacts. Skipped ${result.skipped} duplicates or invalid rows.`,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to bulk import contacts" },
      { status: 500 }
    );
  }
}

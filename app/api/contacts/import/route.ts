import { NextRequest, NextResponse } from "next/server";
import { StrapiClient } from "@/lib/strapi/client";

const strapiClient = new StrapiClient();

export async function POST(request: NextRequest) {
  try {
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

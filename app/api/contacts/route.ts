import { NextRequest, NextResponse } from "next/server";
import { StrapiClient } from "@/lib/strapi/client";

const strapiClient = new StrapiClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase() || "";
    const tag = searchParams.get("tag") || "all";

    const conversations = await strapiClient.getConversations();
    let contactList = conversations.map((c) => ({
      ...c.contact,
      conversationId: c.id,
      windowExpiresAt: c.windowExpiresAt,
      lastMessageAt: c.lastMessageAt,
      unreadCount: c.unreadCount,
    }));

    if (search) {
      contactList = contactList.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.phoneNumber.includes(search) ||
          (c.customAttributes?.company || "").toLowerCase().includes(search)
      );
    }

    if (tag !== "all") {
      contactList = contactList.filter((c) => (c.tags || []).includes(tag));
    }

    return NextResponse.json({
      success: true,
      data: contactList,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phoneNumber, tags, company, customAttributes } = body;

    if (!name || !phoneNumber) {
      return NextResponse.json(
        { error: "Name and Phone Number are required" },
        { status: 400 }
      );
    }

    // Clean and validate phone number
    const rawDigits = phoneNumber.replace(/\D/g, "");
    if (rawDigits.length < 8 || rawDigits.length > 15) {
      return NextResponse.json(
        { error: "Invalid phone number format. Please provide full international format (e.g. +919876543210)" },
        { status: 400 }
      );
    }

    const { contact, conversation } = await strapiClient.createContact({
      name,
      phoneNumber,
      tags: tags || ["New Contact"],
      customAttributes: {
        ...(company ? { company } : {}),
        ...(customAttributes || {}),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...contact,
        conversationId: conversation.id,
        windowExpiresAt: conversation.windowExpiresAt,
        lastMessageAt: conversation.lastMessageAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create contact" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, phoneNumber, tags, company, customAttributes } = body;

    if (!id) {
      return NextResponse.json({ error: "Contact ID is required" }, { status: 400 });
    }

    const updated = await strapiClient.updateContact(id, {
      ...(name ? { name } : {}),
      ...(phoneNumber ? { phoneNumber, waId: phoneNumber.replace(/\D/g, "") } : {}),
      ...(tags ? { tags } : {}),
      customAttributes: {
        ...(company ? { company } : {}),
        ...(customAttributes || {}),
      },
    });

    if (!updated) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update contact" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Contact ID is required" }, { status: 400 });
    }

    const deleted = await strapiClient.deleteContact(id);
    return NextResponse.json({ success: deleted });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete contact" },
      { status: 500 }
    );
  }
}

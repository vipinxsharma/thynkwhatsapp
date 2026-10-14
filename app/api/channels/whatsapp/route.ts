import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import {
  getMetaConnectionForNumber, listWhatsAppChannels, renameWhatsAppChannel,
  setDefaultWhatsAppChannel, syncWhatsAppChannelStatus,
} from "@/lib/meta/connections";
import { MetaGraphClient } from "@/lib/meta/client";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ data: await listWhatsAppChannels(auth.session.tenantId) });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null);
  const phoneNumberId = body?.phoneNumberId;
  if (typeof phoneNumberId !== "string" || !/^\d{5,30}$/.test(phoneNumberId)) {
    return NextResponse.json({ error: "Valid phone number ID required" }, { status: 400 });
  }
  let updated = false;
  if (body.action === "rename") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 1 || name.length > 60) {
      return NextResponse.json({ error: "Channel name must contain 1–60 characters" }, { status: 400 });
    }
    updated = await renameWhatsAppChannel(auth.session.tenantId, phoneNumberId, name);
  } else if (body.action === "make_default") {
    updated = await setDefaultWhatsAppChannel(auth.session.tenantId, phoneNumberId);
  } else {
    return NextResponse.json({ error: "Unsupported channel action" }, { status: 400 });
  }
  return updated
    ? NextResponse.json({ data: await listWhatsAppChannels(auth.session.tenantId) })
    : NextResponse.json({ error: "Connected channel not found in this workspace" }, { status: 404 });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null);
  const phoneNumberId = body?.phoneNumberId;
  if (typeof phoneNumberId !== "string" || !/^\d{5,30}$/.test(phoneNumberId)) {
    return NextResponse.json({ error: "Valid phone number ID required" }, { status: 400 });
  }
  const connection = await getMetaConnectionForNumber(auth.session.tenantId, phoneNumberId);
  if (!connection) return NextResponse.json({ error: "Connected channel not found" }, { status: 404 });
  try {
    const numbers = await new MetaGraphClient(connection.accessToken).listPhoneNumbers(connection.wabaId);
    const phone = numbers.find((item) => String(item.id) === phoneNumberId);
    if (!phone) {
      return NextResponse.json({ error: "Meta did not list this number under its recorded WABA. No local status was changed." }, { status: 409 });
    }
    await syncWhatsAppChannelStatus({
      workspaceId: auth.session.tenantId, wabaId: connection.wabaId, phoneNumberId,
      displayPhoneNumber: phone.display_phone_number, verifiedName: phone.verified_name,
      metaStatus: "LISTED_BY_META", qualityRating: phone.quality_rating,
      codeVerificationStatus: phone.code_verification_status,
    });
    return NextResponse.json({ data: await listWhatsAppChannels(auth.session.tenantId) });
  } catch {
    return NextResponse.json({ error: "Meta status could not be refreshed. Existing status was retained." }, { status: 502 });
  }
}

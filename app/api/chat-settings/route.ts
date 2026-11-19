import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { RuleValidationError } from "@/lib/automations/reply";
import { parseChatSettings } from "@/lib/chat-settings/handling";
import { getChatSettings, listBlockedNumbers, saveChatSettings } from "@/lib/chat-settings/store";

const noStore = { "Cache-Control": "no-store" };

function failure(error: unknown) {
  if (error instanceof RuleValidationError) return NextResponse.json({ error: error.message }, { status: 400, headers: noStore });
  console.error("[Chat Settings Error]", error);
  return NextResponse.json({ error: "Chat settings are unavailable. Please contact your administrator." }, { status: 503, headers: noStore });
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  try {
    const [settings, blockedNumbers] = await Promise.all([
      getChatSettings(auth.session.tenantId),
      listBlockedNumbers(auth.session.tenantId),
    ]);
    return NextResponse.json({ settings, blockedNumbers }, { headers: noStore });
  } catch (error) { return failure(error); }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  try {
    let body: unknown;
    try { body = await request.json(); } catch { throw new RuleValidationError("Invalid JSON"); }
    const settings = parseChatSettings(body);
    const saved = await saveChatSettings(auth.session.tenantId, auth.session.userId, settings);
    return NextResponse.json({ settings: saved }, { headers: noStore });
  } catch (error) { return failure(error); }
}

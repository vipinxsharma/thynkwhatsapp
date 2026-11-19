import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { RuleValidationError } from "@/lib/automations/reply";
import { parseBlockedNumber } from "@/lib/chat-settings/handling";
import { blockNumber, listBlockedNumbers, unblockNumber } from "@/lib/chat-settings/store";

const noStore = { "Cache-Control": "no-store" };

function failure(error: unknown) {
  if (error instanceof RuleValidationError) return NextResponse.json({ error: error.message }, { status: 400, headers: noStore });
  console.error("[Blocked Numbers Error]", error);
  return NextResponse.json({ error: "Blocked numbers are unavailable. Please contact your administrator." }, { status: 503, headers: noStore });
}

/** Blocked senders are still stored in the inbox, but never answered by bots or handled by keywords. */
export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  try {
    let body: { phone?: unknown } | null;
    try { body = await request.json(); } catch { throw new RuleValidationError("Invalid JSON"); }
    const waId = parseBlockedNumber(body?.phone);
    await blockNumber(auth.session.tenantId, auth.session.userId, waId);
    return NextResponse.json({ blockedNumbers: await listBlockedNumbers(auth.session.tenantId) }, { status: 201, headers: noStore });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  try {
    const waId = parseBlockedNumber(request.nextUrl.searchParams.get("waId") || "");
    const removed = await unblockNumber(auth.session.tenantId, waId);
    if (!removed) return NextResponse.json({ error: "Number is not blocked" }, { status: 404, headers: noStore });
    return NextResponse.json({ blockedNumbers: await listBlockedNumbers(auth.session.tenantId) }, { headers: noStore });
  } catch (error) { return failure(error); }
}

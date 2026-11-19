import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { validateAiChatSettings } from "@/lib/ai/chat";
import { getAiChatSettings, saveAiChatSettings } from "@/lib/ai/chat-store";

const noStore = { "Cache-Control": "no-store" };

function failure(error: unknown, status: number) {
  if (status === 400) return NextResponse.json({ error: (error as Error).message }, { status: 400, headers: noStore });
  console.error("[AI Chat Settings Error]", error);
  return NextResponse.json({ error: "AI chat settings are unavailable. Please contact your administrator." }, { status: 503, headers: noStore });
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
  if (!auth.ok) return auth.response;
  try {
    const settings = await getAiChatSettings(auth.session.tenantId);
    return NextResponse.json({ settings }, { headers: noStore });
  } catch (error) {
    return failure(error, 503);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  let input;
  try {
    let body: unknown;
    try { body = await request.json(); } catch { throw new Error("Invalid JSON"); }
    input = validateAiChatSettings(body);
  } catch (error) {
    return failure(error, 400);
  }
  try {
    const settings = await saveAiChatSettings(auth.session.tenantId, auth.session.userId, input);
    return NextResponse.json({ settings }, { headers: noStore });
  } catch (error) {
    return failure(error, 503);
  }
}

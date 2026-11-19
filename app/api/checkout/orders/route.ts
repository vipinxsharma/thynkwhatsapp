import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { parseOrderInput } from "@/lib/checkout/state";
import { createCheckoutOrder } from "@/lib/checkout/service";
import { createNeonCheckoutStore } from "@/lib/checkout/store";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Creates a checkout order for a conversation. No payment is requested until a link is issued. */
export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
  if (!auth.ok) return auth.response;

  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (typeof body.conversationId !== "string" || !uuid.test(body.conversationId)) {
    return NextResponse.json({ error: "Invalid conversation" }, { status: 400 });
  }
  const parsed = parseOrderInput({ amountInr: body.amountInr, description: body.description });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await createCheckoutOrder(createNeonCheckoutStore(), {
    workspaceId: auth.session.tenantId,
    conversationId: body.conversationId,
    actorUserId: auth.session.userId,
    amountPaise: parsed.amountPaise,
    description: parsed.description,
    newId: () => crypto.randomUUID(),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ success: true, data: { orderId: result.orderId, status: "created" } }, { status: 201 });
}

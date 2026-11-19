import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { cashfreeCredentials } from "@/lib/billing/cashfree";
import { createCashfreePaymentLink } from "@/lib/checkout/cashfree-links";
import { issuePaymentLink } from "@/lib/checkout/service";
import { createNeonCheckoutStore } from "@/lib/checkout/store";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK_TTL_MS = 48 * 60 * 60 * 1000;

/** Creates a Cashfree payment link for an order and moves it to link_sent. Send the returned URL to the customer. */
export async function POST(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
  if (!auth.ok) return auth.response;

  const { orderId } = await context.params;
  if (!uuid.test(orderId)) return NextResponse.json({ error: "Invalid order" }, { status: 400 });

  const creds = cashfreeCredentials();
  if (!creds) return NextResponse.json({ error: "Payments are not configured yet" }, { status: 503 });

  const origin = request.nextUrl.origin;
  const returnUrl = process.env.CHECKOUT_RETURN_URL || null;
  const result = await issuePaymentLink(
    {
      store: createNeonCheckoutStore(),
      now: new Date(),
      linkTtlMs: LINK_TTL_MS,
      newLinkId: () => `co_${crypto.randomBytes(16).toString("hex")}`,
      issuer: {
        create: (input) =>
          createCashfreePaymentLink(creds, {
            ...input,
            // Cashfree expects the 10-digit mobile number; stored contacts may include the country code.
            customerPhone: input.customerPhone.replace(/\D/g, "").slice(-10),
            notifyUrl: `${origin}/api/checkout/webhook`,
            returnUrl,
          }),
      },
    },
    { workspaceId: auth.session.tenantId, orderId }
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(
    {
      success: true,
      data: { orderId: result.orderId, status: "link_sent", paymentLinkUrl: result.linkUrl, expiresAt: result.expiresAt.toISOString() },
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}

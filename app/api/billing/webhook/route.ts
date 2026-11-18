import { NextRequest, NextResponse } from "next/server";
import { cashfreeCredentials, fetchCashfreeOrderStatus } from "@/lib/billing/cashfree";
import { verifyCashfreeSignature } from "@/lib/billing/webhook";
import { activatePaidOrder, findOrderPlanCode } from "@/lib/billing/orders";
import { findBillingPlan } from "@/lib/billing/plans";

// Public route (listed in proxy.ts). Trust comes from the signature and a server-side status check.
export async function POST(request: NextRequest) {
  const creds = cashfreeCredentials();
  if (!creds) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const rawBody = await request.text();
  const valid = verifyCashfreeSignature({
    rawBody,
    timestamp: request.headers.get("x-webhook-timestamp"),
    signature: request.headers.get("x-webhook-signature"),
    secret: creds.clientSecret,
  });
  if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let event: { type?: string; data?: { order?: { order_id?: string } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const orderId = event.data?.order?.order_id;
  if (event.type !== "PAYMENT_SUCCESS_WEBHOOK" || !orderId) {
    return NextResponse.json({ received: true });
  }

  const status = await fetchCashfreeOrderStatus(creds, orderId);
  if (status !== "PAID") return NextResponse.json({ received: true, status });
  const plan = findBillingPlan(await findOrderPlanCode(orderId));
  if (!plan) return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  const result = await activatePaidOrder({ cashfreeOrderId: orderId, plan });
  return NextResponse.json({ received: true, activated: result.activated });
}

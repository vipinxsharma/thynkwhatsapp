import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { cashfreeCredentials, fetchCashfreeOrderStatus } from "@/lib/billing/cashfree";
import { activatePaidOrder, getBillingOrder } from "@/lib/billing/orders";
import { findBillingPlan } from "@/lib/billing/plans";

// Used by the return page. If the webhook has not arrived yet, ask Cashfree directly.
export async function GET(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  const { orderId } = await context.params;

  const order = await getBillingOrder(auth.session.tenantId, orderId);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (order.status !== "paid") {
    const creds = cashfreeCredentials();
    if (creds) {
      const remote = await fetchCashfreeOrderStatus(creds, orderId);
      if (remote === "PAID") {
        const plan = findBillingPlan(order.planCode);
        if (plan) await activatePaidOrder({ cashfreeOrderId: orderId, plan });
        return NextResponse.json({ status: "paid" }, { headers: { "Cache-Control": "no-store" } });
      }
    }
  }
  return NextResponse.json({ status: order.status }, { headers: { "Cache-Control": "no-store" } });
}

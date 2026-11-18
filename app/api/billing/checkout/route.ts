import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { findBillingPlan, isValidIndianMobile } from "@/lib/billing/plans";
import { cashfreeCredentials, createCashfreeOrder } from "@/lib/billing/cashfree";
import { createBillingOrder } from "@/lib/billing/orders";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as { planId?: unknown; phone?: unknown } | null;
  const plan = findBillingPlan(body?.planId);
  if (!plan) return NextResponse.json({ error: "Choose a valid plan" }, { status: 400 });
  if (!isValidIndianMobile(body?.phone)) {
    return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
  }

  const creds = cashfreeCredentials();
  if (!creds) {
    return NextResponse.json({ error: "Payments are not configured yet" }, { status: 503 });
  }

  const order = await createBillingOrder({
    workspaceId: auth.session.tenantId,
    plan,
    requestedByAuthUserId: auth.session.userId,
  });
  const origin = request.nextUrl.origin;
  try {
    const { paymentSessionId } = await createCashfreeOrder(creds, {
      orderId: order.cashfreeOrderId,
      amountInr: plan.priceInr,
      customerId: auth.session.userId.replace(/[^A-Za-z0-9_-]/g, "_"),
      customerEmail: auth.session.email,
      customerPhone: body.phone,
      returnUrl: `${origin}/billing/return?order_id=${encodeURIComponent(order.cashfreeOrderId)}`,
      notifyUrl: `${origin}/api/billing/webhook`,
    });
    return NextResponse.json({
      success: true,
      data: { orderId: order.cashfreeOrderId, paymentSessionId, environment: creds.env },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not start checkout. Try again shortly." }, { status: 502 });
  }
}

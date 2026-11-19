import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { findBillingPlan, isValidIndianMobile, planAmountPaise } from "@/lib/billing/plans";
import { cashfreeCredentials, createCashfreeOrder } from "@/lib/billing/cashfree";
import { createBillingOrder } from "@/lib/billing/orders";
import { computeGst } from "@/lib/billing/gst";
import { sellerTaxConfig } from "@/lib/billing/seller";
import { parseBuyerTaxInput, upsertTaxProfile } from "@/lib/billing/taxProfile";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;

  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const plan = findBillingPlan(body.planId);
  if (!plan) return NextResponse.json({ error: "Choose a valid plan" }, { status: 400 });
  if (!isValidIndianMobile(body.phone)) {
    return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
  }
  const buyer = parseBuyerTaxInput(body);
  if (!buyer.ok) return NextResponse.json({ error: buyer.error }, { status: 400 });

  const seller = sellerTaxConfig();
  const creds = cashfreeCredentials();
  if (!seller || !creds) {
    return NextResponse.json({ error: "Payments are not configured yet" }, { status: 503 });
  }

  // Tax is computed server-side from the plan and the buyer's state, never from client input.
  const tax = computeGst({
    basePaise: planAmountPaise(plan),
    sellerStateCode: seller.stateCode,
    buyerStateCode: buyer.value.stateCode,
    ratePercent: seller.ratePercent,
  });
  await upsertTaxProfile(auth.session.tenantId, auth.session.userId, buyer.value);
  const order = await createBillingOrder({
    workspaceId: auth.session.tenantId,
    plan,
    requestedByAuthUserId: auth.session.userId,
    tax: {
      baseInrPaise: tax.baseInrPaise,
      gstInrPaise: tax.totalInrPaise - tax.baseInrPaise,
      totalInrPaise: tax.totalInrPaise,
      buyerStateCode: buyer.value.stateCode,
      buyerGstin: buyer.value.gstin,
    },
  });
  const origin = request.nextUrl.origin;
  try {
    const { paymentSessionId } = await createCashfreeOrder(creds, {
      orderId: order.cashfreeOrderId,
      amountInr: Number((tax.totalInrPaise / 100).toFixed(2)),
      customerId: auth.session.userId.replace(/[^A-Za-z0-9_-]/g, "_"),
      customerEmail: auth.session.email,
      customerPhone: body.phone,
      returnUrl: `${origin}/billing/return?order_id=${encodeURIComponent(order.cashfreeOrderId)}`,
      notifyUrl: `${origin}/api/billing/webhook`,
    });
    return NextResponse.json({
      success: true,
      data: {
        orderId: order.cashfreeOrderId,
        paymentSessionId,
        environment: creds.env,
        breakdown: {
          baseInr: tax.baseInrPaise / 100,
          cgstInr: tax.cgstPaise / 100,
          sgstInr: tax.sgstPaise / 100,
          igstInr: tax.igstPaise / 100,
          totalInr: tax.totalInrPaise / 100,
          rateSplit: tax.rateSplit,
        },
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not start checkout. Try again shortly." }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { cashfreeCredentials } from "@/lib/billing/cashfree";
import { fetchCashfreePaymentLink } from "@/lib/checkout/cashfree-links";
import { processCheckoutEvent } from "@/lib/checkout/service";
import { createNeonCheckoutStore } from "@/lib/checkout/store";
import { parseCheckoutWebhook, verifyCashfreeSignature } from "@/lib/checkout/webhook";

// Public route (listed in proxy.ts). The signature is checked on the raw body first, then the link
// status is confirmed with Cashfree before any order is marked paid.
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

  const parsed = parseCheckoutWebhook(rawBody);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await processCheckoutEvent(
    {
      store: createNeonCheckoutStore(),
      now: new Date(),
      fetchLink: (linkId) => fetchCashfreePaymentLink(creds, linkId),
    },
    parsed.event
  );
  // Always 200 for a verified event we do not act on, so Cashfree stops retrying it.
  return NextResponse.json({ received: true, handled: result.handled, ...(result.handled ? { outcome: result.outcome, duplicate: result.duplicate } : {}) });
}

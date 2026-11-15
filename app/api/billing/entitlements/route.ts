import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { getEntitlementSnapshot, evaluateEntitlement, entitlementFeatures } from "@/lib/billing/entitlements";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;

  try {
    const snapshot = await getEntitlementSnapshot(auth.session.tenantId);
    const usableFeatures = entitlementFeatures.filter(
      (feature) => evaluateEntitlement(snapshot, feature).allowed
    );
    return NextResponse.json(
      {
        status: snapshot.status,
        planCode: snapshot.planCode,
        currentPeriodStart: snapshot.currentPeriodStart,
        currentPeriodEnd: snapshot.currentPeriodEnd,
        features: usableFeatures,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Subscription status is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

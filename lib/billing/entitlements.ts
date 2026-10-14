import { neon } from "@neondatabase/serverless";

export const entitlementFeatures = [
  "whatsapp_send",
  "campaign_send",
  "ai_support",
  "team_invites",
] as const;

export type EntitlementFeature = (typeof entitlementFeatures)[number];
export type SubscriptionStatus =
  | "none"
  | "pending"
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export interface EntitlementSnapshot {
  status: SubscriptionStatus;
  planCode: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  features: EntitlementFeature[];
}

export type EntitlementDecision =
  | { allowed: true }
  | { allowed: false; reason: "no_subscription" | "inactive" | "outside_period" | "feature_not_granted" };

const emptySnapshot: EntitlementSnapshot = {
  status: "none",
  planCode: null,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  features: [],
};

export function evaluateEntitlement(
  snapshot: EntitlementSnapshot,
  feature: EntitlementFeature,
  now: Date = new Date()
): EntitlementDecision {
  if (snapshot.status === "none") return { allowed: false, reason: "no_subscription" };
  if (snapshot.status !== "active" && snapshot.status !== "trialing") {
    return { allowed: false, reason: "inactive" };
  }
  const periodStart = snapshot.currentPeriodStart && new Date(snapshot.currentPeriodStart).getTime();
  const periodEnd = snapshot.currentPeriodEnd && new Date(snapshot.currentPeriodEnd).getTime();
  if (!periodStart || !periodEnd || !Number.isFinite(periodStart) || !Number.isFinite(periodEnd)
    || periodStart > now.getTime() || periodEnd <= now.getTime()) {
    return { allowed: false, reason: "outside_period" };
  }
  if (!snapshot.features.includes(feature)) return { allowed: false, reason: "feature_not_granted" };
  return { allowed: true };
}

export async function getEntitlementSnapshot(workspaceId: string): Promise<EntitlementSnapshot> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  const db = neon(process.env.DATABASE_URL);
  const subscriptions = await db.query(
    `SELECT plan_code AS "planCode", status,
            current_period_start AS "currentPeriodStart", current_period_end AS "currentPeriodEnd"
     FROM app_workspace_subscriptions WHERE workspace_id = $1::uuid LIMIT 1`,
    [workspaceId]
  );
  const subscription = subscriptions[0] as {
    planCode: string; status: SubscriptionStatus;
    currentPeriodStart: Date | string; currentPeriodEnd: Date | string;
  } | undefined;
  if (!subscription) return { ...emptySnapshot };

  const grants = await db.query(
    `SELECT feature_code AS "featureCode" FROM app_workspace_entitlements
     WHERE workspace_id = $1::uuid AND enabled = true`,
    [workspaceId]
  );
  const features = grants
    .map((row) => (row as { featureCode: string }).featureCode)
    .filter((feature): feature is EntitlementFeature =>
      entitlementFeatures.includes(feature as EntitlementFeature)
    );
  return {
    status: subscription.status,
    planCode: subscription.planCode,
    currentPeriodStart: new Date(subscription.currentPeriodStart).toISOString(),
    currentPeriodEnd: new Date(subscription.currentPeriodEnd).toISOString(),
    features,
  };
}

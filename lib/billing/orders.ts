import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { BillingPlan } from "@/lib/billing/plans";
import { planAmountPaise, planPeriodEnd } from "@/lib/billing/plans";
import { entitlementFeatures } from "@/lib/billing/entitlements";

function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

export async function createBillingOrder(input: {
  workspaceId: string;
  plan: BillingPlan;
  requestedByAuthUserId: string;
}): Promise<{ id: string; cashfreeOrderId: string; amountInr: number }> {
  const id = crypto.randomUUID();
  // Cashfree order ids are unique per merchant. Use the row id so retries never collide.
  const cashfreeOrderId = `xc_${id.replace(/-/g, "")}`;
  await sql().query(
    `INSERT INTO app_billing_orders
       (id, workspace_id, plan_code, amount_paise, cashfree_order_id, requested_by_auth_user_id)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)`,
    [id, input.workspaceId, input.plan.id, planAmountPaise(input.plan), cashfreeOrderId, input.requestedByAuthUserId]
  );
  return { id, cashfreeOrderId, amountInr: input.plan.priceInr };
}

export async function getBillingOrder(workspaceId: string, cashfreeOrderId: string) {
  const rows = await sql().query(
    `SELECT id, plan_code AS "planCode", status, cashfree_order_id AS "cashfreeOrderId"
     FROM app_billing_orders WHERE workspace_id = $1::uuid AND cashfree_order_id = $2`,
    [workspaceId, cashfreeOrderId]
  );
  return (rows[0] as { id: string; planCode: string; status: string; cashfreeOrderId: string } | undefined) ?? null;
}

// Idempotent: a repeated webhook or return-page check does not extend the period twice.
// The subscription row is keyed by workspace, so the newest verified payment wins.
export async function activatePaidOrder(input: {
  cashfreeOrderId: string;
  plan: BillingPlan;
}): Promise<{ activated: boolean; workspaceId: string | null }> {
  const database = sql();
  const updated = (await database.query(
    `UPDATE app_billing_orders SET status = 'paid', paid_at = now(), updated_at = now()
     WHERE cashfree_order_id = $1 AND status <> 'paid'
     RETURNING workspace_id AS "workspaceId"`,
    [input.cashfreeOrderId]
  )) as Array<{ workspaceId: string }>;
  const workspaceId = updated[0]?.workspaceId ?? null;
  if (!workspaceId) return { activated: false, workspaceId: null };

  const start = new Date();
  const end = planPeriodEnd(input.plan, start);
  await database.query(
    `INSERT INTO app_workspace_subscriptions
       (workspace_id, plan_code, status, source, source_reference, current_period_start, current_period_end, verified_at)
     VALUES ($1::uuid, $2, 'active', 'cashfree', $3, $4, $5, now())
     ON CONFLICT (workspace_id) DO UPDATE SET
       plan_code = EXCLUDED.plan_code, status = 'active', source_reference = EXCLUDED.source_reference,
       current_period_start = EXCLUDED.current_period_start, current_period_end = EXCLUDED.current_period_end,
       verified_at = now(), updated_at = now()`,
    [workspaceId, input.plan.id, input.cashfreeOrderId, start.toISOString(), end.toISOString()]
  );
  for (const feature of entitlementFeatures) {
    await database.query(
      `INSERT INTO app_workspace_entitlements (workspace_id, feature_code, enabled)
       VALUES ($1::uuid, $2, true)
       ON CONFLICT (workspace_id, feature_code) DO UPDATE SET enabled = true, updated_at = now()`,
      [workspaceId, feature]
    );
  }
  return { activated: true, workspaceId };
}

// Used by the webhook, which only knows the Cashfree order id. Returns the plan the order was created for.
export async function findOrderPlanCode(cashfreeOrderId: string): Promise<string | null> {
  const rows = await sql().query(
    `SELECT plan_code AS "planCode" FROM app_billing_orders WHERE cashfree_order_id = $1`,
    [cashfreeOrderId]
  );
  return (rows[0] as { planCode: string } | undefined)?.planCode ?? null;
}

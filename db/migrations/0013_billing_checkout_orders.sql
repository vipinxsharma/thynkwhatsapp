-- Checkout orders created by the owner/admin before payment. Only the verified
-- Cashfree webhook or a server-side order status check may mark an order paid.
CREATE TABLE IF NOT EXISTS app_billing_orders (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  plan_code text NOT NULL CHECK (plan_code ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  cashfree_order_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed', 'expired')),
  requested_by_auth_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_billing_orders_workspace_idx
  ON app_billing_orders (workspace_id, created_at DESC);

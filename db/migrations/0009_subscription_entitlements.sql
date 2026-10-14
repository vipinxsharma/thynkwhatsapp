-- Trusted billing reconciliation will write these tables after provider verification.
-- There is deliberately no customer-facing activation or payment mutation here.
CREATE TABLE IF NOT EXISTS app_workspace_subscriptions (
  workspace_id uuid PRIMARY KEY REFERENCES app_workspaces(id) ON DELETE CASCADE,
  plan_code text NOT NULL CHECK (plan_code ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  status text NOT NULL CHECK (status IN ('pending', 'trialing', 'active', 'past_due', 'cancelled', 'expired')),
  source text NOT NULL CHECK (source = 'cashfree'),
  source_reference text NOT NULL,
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_reference),
  CHECK (current_period_end > current_period_start)
);

CREATE TABLE IF NOT EXISTS app_workspace_entitlements (
  workspace_id uuid NOT NULL REFERENCES app_workspace_subscriptions(workspace_id) ON DELETE CASCADE,
  feature_code text NOT NULL CHECK (feature_code IN (
    'whatsapp_send', 'campaign_send', 'ai_support', 'team_invites'
  )),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, feature_code)
);

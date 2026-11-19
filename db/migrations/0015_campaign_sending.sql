-- Bulk campaign sending: marketing consent per contact, a campaign, and one
-- durable row per recipient so a send is never repeated and every outcome is kept.

CREATE TABLE IF NOT EXISTS app_contact_marketing_consent (
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('opted_in', 'opted_out')),
  source text NOT NULL CHECK (source IN ('manual', 'inbound_keyword')),
  recorded_by_auth_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, contact_id),
  FOREIGN KEY (workspace_id, contact_id)
    REFERENCES app_inbox_contacts(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_campaigns (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  phone_number_id text NOT NULL,
  waba_id text NOT NULL,
  template_name text NOT NULL,
  template_language text NOT NULL,
  template_variables jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(template_variables) = 'array'),
  audience_tag text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sending', 'paused', 'completed', 'cancelled')),
  total_recipients integer NOT NULL DEFAULT 0 CHECK (total_recipients >= 0),
  last_error text,
  created_by_auth_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);

CREATE INDEX IF NOT EXISTS app_campaigns_workspace_idx
  ON app_campaigns (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS app_campaigns_active_idx
  ON app_campaigns (status) WHERE status = 'sending';

CREATE TABLE IF NOT EXISTS app_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  wa_id text NOT NULL,
  contact_name text NOT NULL DEFAULT '',
  -- pending: not attempted. sending: claimed by a worker. sent/delivered/read: accepted by Meta.
  -- failed: Meta refused it. uncertain: outcome unknown, never retried. skipped: consent withdrawn.
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'read', 'failed', 'uncertain', 'skipped')),
  wam_id text,
  error text,
  attempted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, contact_id),
  FOREIGN KEY (workspace_id, campaign_id)
    REFERENCES app_campaigns(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS app_campaign_recipients_status_idx
  ON app_campaign_recipients (campaign_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS app_campaign_recipients_wam_idx
  ON app_campaign_recipients (workspace_id, wam_id) WHERE wam_id IS NOT NULL;

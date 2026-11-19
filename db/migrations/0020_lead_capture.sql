-- Lead capture: button taps become leads, grouped per contact and placed on user-defined stages.

CREATE TABLE IF NOT EXISTS app_lead_stages (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);

-- Exactly one default ("New") stage per workspace; new leads land there.
CREATE UNIQUE INDEX IF NOT EXISTS app_lead_stages_default_idx
  ON app_lead_stages (workspace_id) WHERE is_default;

CREATE UNIQUE INDEX IF NOT EXISTS app_lead_stages_name_idx
  ON app_lead_stages (workspace_id, lower(name));

CREATE INDEX IF NOT EXISTS app_lead_stages_order_idx
  ON app_lead_stages (workspace_id, position);

CREATE TABLE IF NOT EXISTS app_leads (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('interactive_button', 'template_button')),
  last_button_text text NOT NULL DEFAULT '',
  last_button_payload text NOT NULL DEFAULT '',
  campaign_ref text,
  tap_count integer NOT NULL DEFAULT 1 CHECK (tap_count >= 1),
  first_tapped_at timestamptz NOT NULL,
  last_tapped_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, contact_id),
  FOREIGN KEY (workspace_id, contact_id) REFERENCES app_inbox_contacts(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, stage_id) REFERENCES app_lead_stages(workspace_id, id)
);

CREATE INDEX IF NOT EXISTS app_leads_recent_idx
  ON app_leads (workspace_id, last_tapped_at DESC);

CREATE INDEX IF NOT EXISTS app_leads_stage_idx
  ON app_leads (workspace_id, stage_id);

-- One row per inbound button tap. The Meta message id makes webhook retries idempotent.
CREATE TABLE IF NOT EXISTS app_lead_taps (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  wam_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('interactive_button', 'template_button')),
  button_text text NOT NULL DEFAULT '',
  button_payload text NOT NULL DEFAULT '',
  context_wam_id text,
  campaign_ref text,
  tapped_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, wam_id),
  FOREIGN KEY (workspace_id, contact_id) REFERENCES app_inbox_contacts(workspace_id, id) ON DELETE CASCADE
);

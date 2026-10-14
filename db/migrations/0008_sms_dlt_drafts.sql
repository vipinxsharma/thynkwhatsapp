CREATE TABLE IF NOT EXISTS app_sms_dlt_drafts (
  workspace_id uuid PRIMARY KEY REFERENCES app_workspaces(id) ON DELETE CASCADE,
  access_provider text NOT NULL CHECK (access_provider IN ('airtel', 'vi', 'jio', 'other')),
  principal_entity_id text,
  delivery_partner_name text,
  updated_by_auth_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

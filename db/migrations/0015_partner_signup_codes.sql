-- Records which partner journey a workspace signed up through (from the ?partner= link).
-- One row per workspace; the first captured code is kept.
CREATE TABLE IF NOT EXISTS app_partner_signup_codes (
  workspace_id uuid PRIMARY KEY REFERENCES app_workspaces(id) ON DELETE CASCADE,
  partner_code text NOT NULL CHECK (partner_code ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_partner_signup_codes_partner_idx
  ON app_partner_signup_codes (partner_code);

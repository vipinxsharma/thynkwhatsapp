CREATE TABLE IF NOT EXISTS app_workspace_invitations (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'agent', 'viewer')),
  token_hash text NOT NULL UNIQUE,
  invited_by_auth_user_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by_auth_user_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_workspace_invitations_pending_email_idx
  ON app_workspace_invitations (workspace_id, invited_email)
  WHERE accepted_at IS NULL;

CREATE INDEX IF NOT EXISTS app_workspace_invitations_expiry_idx
  ON app_workspace_invitations (expires_at)
  WHERE accepted_at IS NULL;

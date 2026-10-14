CREATE TABLE IF NOT EXISTS app_workspaces (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_by_auth_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_workspace_members (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  auth_user_id text NOT NULL,
  email text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'agent', 'viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, auth_user_id)
);

CREATE INDEX IF NOT EXISTS app_workspace_members_user_idx
  ON app_workspace_members (auth_user_id, status);

CREATE TABLE IF NOT EXISTS app_audit_logs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  auth_user_id text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_audit_logs_workspace_created_idx
  ON app_audit_logs (workspace_id, created_at DESC);

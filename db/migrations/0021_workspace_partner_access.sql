-- Partner features for a workspace. A tenant requests access; a platform superadmin
-- approves, rejects, or assigns it directly. Only an approved row shows partner features.
CREATE TABLE IF NOT EXISTS app_workspace_partner_access (
  workspace_id uuid PRIMARY KEY REFERENCES app_workspaces(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('requested', 'approved', 'rejected')),
  requested_by_auth_user_id text,
  requested_at timestamptz,
  decided_by_auth_user_id text,
  decided_at timestamptz,
  decision text CHECK (decision IN ('approved', 'rejected', 'assigned')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

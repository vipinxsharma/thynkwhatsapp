-- The CRM a workspace chose to pair with Xeccel. One choice per workspace;
-- an owner or admin can change it until access has been provisioned.
CREATE TABLE IF NOT EXISTS app_workspace_crm_choices (
  workspace_id uuid PRIMARY KEY REFERENCES app_workspaces(id) ON DELETE CASCADE,
  crm_code text NOT NULL CHECK (crm_code IN ('coldcall', 'supercrm')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'provisioned')),
  chosen_by_auth_user_id text NOT NULL,
  contact_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

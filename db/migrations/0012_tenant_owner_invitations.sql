-- Platform-admin tenant owner invitations.
-- Additive: existing member invitations keep kind = 'member' and their workspace_id.
ALTER TABLE app_workspace_invitations
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'member'
    CHECK (kind IN ('member', 'tenant_owner')),
  ADD COLUMN IF NOT EXISTS workspace_name text
    CHECK (workspace_name IS NULL OR length(workspace_name) BETWEEN 1 AND 120),
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- A tenant owner invitation has no workspace until it is accepted.
ALTER TABLE app_workspace_invitations
  ALTER COLUMN workspace_id DROP NOT NULL;

ALTER TABLE app_workspace_invitations
  DROP CONSTRAINT IF EXISTS app_workspace_invitations_kind_shape_check;
ALTER TABLE app_workspace_invitations
  ADD CONSTRAINT app_workspace_invitations_kind_shape_check
    CHECK (
      (kind = 'member' AND workspace_id IS NOT NULL)
      OR (kind = 'tenant_owner' AND workspace_name IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS app_workspace_invitations_tenant_owner_pending_idx
  ON app_workspace_invitations (expires_at, created_at)
  WHERE kind = 'tenant_owner' AND accepted_at IS NULL AND revoked_at IS NULL;

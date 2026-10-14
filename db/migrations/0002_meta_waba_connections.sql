CREATE TABLE IF NOT EXISTS app_waba_connections (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  waba_id text NOT NULL UNIQUE,
  phone_number_id text NOT NULL UNIQUE,
  display_phone_number text,
  verified_name text,
  encrypted_access_token text NOT NULL,
  access_token_iv text NOT NULL,
  access_token_tag text NOT NULL,
  webhook_subscribed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'restricted', 'disconnected')),
  connected_by_auth_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, waba_id)
);

CREATE INDEX IF NOT EXISTS app_waba_connections_workspace_idx
  ON app_waba_connections (workspace_id, status);

CREATE TABLE IF NOT EXISTS app_outbound_requests (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  request_hash text NOT NULL,
  requested_by_auth_user_id text NOT NULL,
  phone_number_id text NOT NULL,
  recipient_wa_id text NOT NULL,
  message_type text NOT NULL,
  message_body text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'accepted', 'rejected', 'uncertain')),
  wam_id text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, conversation_id)
    REFERENCES app_inbox_conversations(workspace_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS app_outbound_requests_wam_idx
  ON app_outbound_requests (workspace_id, wam_id) WHERE wam_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS app_outbound_requests_status_idx
  ON app_outbound_requests (workspace_id, status, created_at DESC);

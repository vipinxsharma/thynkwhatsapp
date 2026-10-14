CREATE TABLE IF NOT EXISTS app_support_cases (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  requester_auth_user_id text,
  requester_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'triaged', 'awaiting_customer', 'auto_resolved', 'escalated', 'closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  source_channel text NOT NULL CHECK (source_channel IN ('chat', 'email')),
  external_source_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, external_source_id)
);

CREATE INDEX IF NOT EXISTS app_support_cases_workspace_status_idx
  ON app_support_cases (workspace_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS app_support_messages (
  id uuid PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES app_support_cases(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('chat', 'email')),
  sender_type text NOT NULL CHECK (sender_type IN ('customer', 'ai', 'human', 'system')),
  body text NOT NULL,
  external_message_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, external_message_id)
);

CREATE INDEX IF NOT EXISTS app_support_messages_case_created_idx
  ON app_support_messages (case_id, created_at ASC);

CREATE TABLE IF NOT EXISTS app_support_email_outbox (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES app_support_cases(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0,
  provider_message_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

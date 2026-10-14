CREATE TABLE IF NOT EXISTS app_inbox_contacts (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  wa_id text NOT NULL,
  phone_number text NOT NULL,
  name text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tags) = 'array'),
  custom_attributes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(custom_attributes) = 'object'),
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, wa_id)
);

CREATE TABLE IF NOT EXISTS app_inbox_conversations (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  phone_number_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed')),
  window_expires_at timestamptz NOT NULL DEFAULT now() - interval '1 second',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  unread_count integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, contact_id, phone_number_id),
  FOREIGN KEY (workspace_id, contact_id) REFERENCES app_inbox_contacts(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS app_inbox_conversations_recent_idx
  ON app_inbox_conversations (workspace_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS app_inbox_messages (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  wam_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  type text NOT NULL,
  body text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('received', 'queued', 'sent', 'delivered', 'read', 'failed')),
  timestamp timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, wam_id),
  FOREIGN KEY (workspace_id, conversation_id) REFERENCES app_inbox_conversations(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS app_inbox_messages_conversation_time_idx
  ON app_inbox_messages (workspace_id, conversation_id, timestamp);

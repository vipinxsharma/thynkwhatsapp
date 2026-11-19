-- Inbox agent tools: conversation assignment, internal notes and saved quick replies.

ALTER TABLE app_inbox_conversations
  ADD COLUMN IF NOT EXISTS assigned_auth_user_id text;

CREATE INDEX IF NOT EXISTS app_inbox_conversations_assignee_idx
  ON app_inbox_conversations (workspace_id, assigned_auth_user_id);

CREATE TABLE IF NOT EXISTS app_inbox_notes (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  author_auth_user_id text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, conversation_id) REFERENCES app_inbox_conversations(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS app_inbox_notes_conversation_idx
  ON app_inbox_notes (workspace_id, conversation_id, created_at);

CREATE TABLE IF NOT EXISTS app_inbox_quick_replies (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1024),
  created_by_auth_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);

CREATE INDEX IF NOT EXISTS app_inbox_quick_replies_workspace_idx
  ON app_inbox_quick_replies (workspace_id, title);

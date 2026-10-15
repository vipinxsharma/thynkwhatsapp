CREATE TABLE IF NOT EXISTS app_automation_rules (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  channel_id text,
  match_type text NOT NULL CHECK (match_type IN ('exact', 'contains')),
  keywords jsonb NOT NULL CHECK (jsonb_typeof(keywords) = 'array'),
  tags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tags) = 'array'),
  conversation_status text CHECK (conversation_status IN ('open', 'pending', 'closed')),
  priority integer NOT NULL DEFAULT 100 CHECK (priority BETWEEN 0 AND 1000),
  enabled boolean NOT NULL DEFAULT false,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);
CREATE INDEX IF NOT EXISTS app_automation_rules_active_idx
  ON app_automation_rules (workspace_id, priority, created_at) WHERE enabled;
CREATE TABLE IF NOT EXISTS app_automation_runs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL,
  rule_name text NOT NULL,
  wam_id text NOT NULL,
  conversation_id uuid NOT NULL,
  applied_actions jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, wam_id),
  FOREIGN KEY (workspace_id, conversation_id)
    REFERENCES app_inbox_conversations(workspace_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS app_automation_runs_recent_idx
  ON app_automation_runs (workspace_id, created_at DESC);

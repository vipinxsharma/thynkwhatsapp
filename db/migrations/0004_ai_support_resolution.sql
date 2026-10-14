CREATE TABLE IF NOT EXISTS app_support_knowledge (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_support_knowledge_workspace_search_idx
  ON app_support_knowledge USING gin (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
  );

CREATE TABLE IF NOT EXISTS app_support_ai_runs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES app_support_cases(id) ON DELETE CASCADE,
  requested_by_auth_user_id text NOT NULL,
  model text NOT NULL,
  status text NOT NULL CHECK (status IN ('started', 'completed', 'escalated', 'failed')),
  category text,
  confidence numeric(4, 3),
  redacted_input_hash text NOT NULL,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS app_support_ai_runs_case_created_idx
  ON app_support_ai_runs (workspace_id, case_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS app_support_ai_runs_active_input_idx
  ON app_support_ai_runs (workspace_id, case_id, redacted_input_hash)
  WHERE status <> 'failed';

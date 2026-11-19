-- Developer API keys, fixed-window rate counters and outbound webhooks.

-- Only a SHA-256 hash of each key is stored. key_prefix is the visible part shown in lists.
CREATE TABLE IF NOT EXISTS app_api_keys (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE CHECK (char_length(key_hash) = 64),
  created_by_auth_user_id text NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_by_auth_user_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_api_keys_workspace_created_idx
  ON app_api_keys (workspace_id, created_at DESC);

-- Fixed one-minute windows per key. Shared across serverless instances, unlike in-memory counters.
CREATE TABLE IF NOT EXISTS app_api_key_rate_windows (
  key_id uuid NOT NULL REFERENCES app_api_keys(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0 CHECK (hits >= 0),
  PRIMARY KEY (key_id, window_start)
);

-- One outbound subscription per workspace: endpoint URL, subscribed events and a signing secret.
-- The signing secret must be readable by the server to sign payloads, so it is stored encrypted
-- with ENCRYPTION_KEY (the same scheme as Meta tokens), never as plain text.
CREATE TABLE IF NOT EXISTS app_webhook_endpoints (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL UNIQUE REFERENCES app_workspaces(id) ON DELETE CASCADE,
  url text NOT NULL CHECK (char_length(url) BETWEEN 1 AND 2048),
  events text[] NOT NULL CHECK (cardinality(events) > 0),
  enabled boolean NOT NULL DEFAULT true,
  encrypted_secret text NOT NULL,
  secret_iv text NOT NULL,
  secret_tag text NOT NULL,
  created_by_auth_user_id text NOT NULL,
  updated_by_auth_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Delivery log and retry queue. event_id is the deduplication key, so a repeated webhook from
-- Meta does not queue the same event twice.
CREATE TABLE IF NOT EXISTS app_webhook_deliveries (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  endpoint_id uuid NOT NULL REFERENCES app_webhook_endpoints(id) ON DELETE CASCADE,
  event_id text NOT NULL CHECK (char_length(event_id) BETWEEN 1 AND 200),
  event_type text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_response_code integer,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (endpoint_id, event_id)
);

CREATE INDEX IF NOT EXISTS app_webhook_deliveries_due_idx
  ON app_webhook_deliveries (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS app_webhook_deliveries_workspace_created_idx
  ON app_webhook_deliveries (workspace_id, created_at DESC);

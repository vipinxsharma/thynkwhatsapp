-- Customer checkout orders raised from a WhatsApp conversation. This is separate from Xeccel's own
-- subscription billing (app_billing_orders in 0013), which is not changed here.
--
-- An order moves to 'paid' only from a verified Cashfree payment event (see lib/checkout/service.ts).
-- Nothing else may write paid_at or paid_amount_paise.
CREATE TABLE IF NOT EXISTS app_checkout_orders (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 200),
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'link_sent', 'paid', 'failed', 'expired')),
  -- Our own id for the Cashfree payment link. Each issued link gets a new id, so a webhook maps to one order.
  cashfree_link_id text UNIQUE CHECK (cashfree_link_id IS NULL OR cashfree_link_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  payment_link_url text,
  link_expires_at timestamptz,
  link_sent_at timestamptz,
  paid_at timestamptz,
  paid_amount_paise integer CHECK (paid_amount_paise IS NULL OR paid_amount_paise > 0),
  provider_payment_ref text,
  failed_at timestamptz,
  expired_at timestamptz,
  created_by_auth_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, contact_id) REFERENCES app_inbox_contacts(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, conversation_id) REFERENCES app_inbox_conversations(workspace_id, id) ON DELETE CASCADE,
  CHECK (status = 'created' OR cashfree_link_id IS NOT NULL),
  CHECK (status <> 'paid' OR (paid_at IS NOT NULL AND provider_payment_ref IS NOT NULL AND paid_amount_paise = amount_paise))
);

CREATE INDEX IF NOT EXISTS app_checkout_orders_recent_idx
  ON app_checkout_orders (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS app_checkout_orders_conversation_idx
  ON app_checkout_orders (workspace_id, conversation_id, created_at DESC);

-- One row per provider event that matched an order. provider_event_key is derived from the event
-- type, link id, payment id and status, so a redelivered webhook is stored once.
CREATE TABLE IF NOT EXISTS app_checkout_payment_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  provider_event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  provider_status text NOT NULL DEFAULT '',
  provider_payment_ref text,
  verified boolean NOT NULL DEFAULT false,
  outcome text NOT NULL CHECK (outcome IN ('paid', 'failed', 'expired', 'ignored')),
  raw_payload jsonb NOT NULL CHECK (jsonb_typeof(raw_payload) = 'object'),
  received_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, order_id) REFERENCES app_checkout_orders(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS app_checkout_payment_events_order_idx
  ON app_checkout_payment_events (workspace_id, order_id, received_at DESC);

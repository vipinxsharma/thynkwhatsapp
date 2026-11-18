-- Auto-reply bots and workspace chat settings: send-reply rule actions, unsubscribe and
-- handover keywords, handover and holding messages, and blocked numbers.

ALTER TABLE app_automation_rules
  ADD COLUMN IF NOT EXISTS reply_text text
    CHECK (reply_text IS NULL OR char_length(reply_text) BETWEEN 1 AND 1024),
  ADD COLUMN IF NOT EXISTS reply_template_name text
    CHECK (reply_template_name IS NULL OR char_length(reply_template_name) BETWEEN 1 AND 512),
  ADD COLUMN IF NOT EXISTS reply_template_language text
    CHECK (reply_template_language IS NULL OR reply_template_language ~ '^[A-Za-z_]{2,10}$'),
  ADD COLUMN IF NOT EXISTS reply_template_variables jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(reply_template_variables) = 'array');

CREATE TABLE IF NOT EXISTS app_workspace_chat_settings (
  workspace_id uuid PRIMARY KEY REFERENCES app_workspaces(id) ON DELETE CASCADE,
  unsubscribe_keyword text
    CHECK (unsubscribe_keyword IS NULL OR char_length(unsubscribe_keyword) BETWEEN 1 AND 40),
  handover_keyword text
    CHECK (handover_keyword IS NULL OR char_length(handover_keyword) BETWEEN 1 AND 40),
  handover_message text
    CHECK (handover_message IS NULL OR char_length(handover_message) BETWEEN 1 AND 1024),
  holding_message text
    CHECK (holding_message IS NULL OR char_length(holding_message) BETWEEN 1 AND 1024),
  updated_by_auth_user_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_blocked_phone_numbers (
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  wa_id text NOT NULL CHECK (wa_id ~ '^[0-9]{8,15}$'),
  blocked_by_auth_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, wa_id)
);

-- Marketing consent model. This is the same definition as 0015_campaign_sending (the campaign
-- branch); both use IF NOT EXISTS, so the table is created once with identical columns.
CREATE TABLE IF NOT EXISTS app_contact_marketing_consent (
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('opted_in', 'opted_out')),
  source text NOT NULL CHECK (source IN ('manual', 'inbound_keyword')),
  recorded_by_auth_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, contact_id),
  FOREIGN KEY (workspace_id, contact_id)
    REFERENCES app_inbox_contacts(workspace_id, id) ON DELETE CASCADE
);

-- Last time a holding message was sent in this conversation, so it is not repeated.
ALTER TABLE app_inbox_conversations
  ADD COLUMN IF NOT EXISTS holding_message_sent_at timestamptz;

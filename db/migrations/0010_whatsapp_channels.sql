-- A WABA owns credentials; each phone number is a separate workspace channel.
-- Keep the original connection row and its unique WABA ownership constraint.
CREATE TABLE IF NOT EXISTS app_whatsapp_channels (
  phone_number_id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  waba_id text NOT NULL,
  display_phone_number text,
  verified_name text,
  channel_name text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  meta_status text,
  quality_rating text,
  code_verification_status text,
  last_synced_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, phone_number_id),
  FOREIGN KEY (workspace_id, waba_id)
    REFERENCES app_waba_connections(workspace_id, waba_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS app_whatsapp_channels_workspace_idx
  ON app_whatsapp_channels (workspace_id, enabled);
CREATE INDEX IF NOT EXISTS app_whatsapp_channels_waba_idx
  ON app_whatsapp_channels (waba_id, enabled);

INSERT INTO app_whatsapp_channels (
  phone_number_id, workspace_id, waba_id, display_phone_number, verified_name
)
SELECT phone_number_id, workspace_id, waba_id, display_phone_number, verified_name
FROM app_waba_connections
ON CONFLICT (phone_number_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS app_workspace_channel_defaults (
  workspace_id uuid PRIMARY KEY REFERENCES app_workspaces(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, phone_number_id)
    REFERENCES app_whatsapp_channels(workspace_id, phone_number_id) ON DELETE CASCADE
);

INSERT INTO app_workspace_channel_defaults (workspace_id, phone_number_id)
SELECT workspace_id, phone_number_id FROM app_waba_connections
ON CONFLICT (workspace_id) DO NOTHING;

-- Give legacy unbound conversations the sender that was default at migration
-- time, but never merge two distinct conversation histories implicitly.
UPDATE app_inbox_conversations c SET phone_number_id = d.phone_number_id
FROM app_workspace_channel_defaults d
WHERE c.workspace_id = d.workspace_id AND c.phone_number_id = ''
  AND NOT EXISTS (
    SELECT 1 FROM app_inbox_conversations existing
    WHERE existing.workspace_id = c.workspace_id
      AND existing.contact_id = c.contact_id
      AND existing.phone_number_id = d.phone_number_id
  );

-- Bounded, tenant-scoped keyset reads of the newest messages per conversation.
CREATE INDEX IF NOT EXISTS app_inbox_messages_recent_page_idx
  ON app_inbox_messages (workspace_id, conversation_id, timestamp DESC, id DESC);

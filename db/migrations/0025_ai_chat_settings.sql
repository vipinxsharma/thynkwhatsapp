-- AI replies for inbound WhatsApp chats. Off by default. The FAQ text is the only source the
-- model may quote or paraphrase. The catalogue table is owned by another feature and is read
-- only through a function that tolerates its absence.

CREATE TABLE IF NOT EXISTS app_ai_chat_settings (
  workspace_id uuid PRIMARY KEY REFERENCES app_workspaces(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  faq_text text CHECK (faq_text IS NULL OR char_length(faq_text) <= 4000),
  handover_contact text CHECK (handover_contact IS NULL OR char_length(handover_contact) <= 200),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

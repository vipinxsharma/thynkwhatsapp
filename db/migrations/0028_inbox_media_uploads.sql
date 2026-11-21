-- Files uploaded to Meta for sending. A media ID can only be sent from the workspace and sender
-- number that uploaded it, so a message cannot reference another tenant's or another number's file.

CREATE TABLE IF NOT EXISTS app_inbox_media_uploads (
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  media_id text NOT NULL CHECK (media_id ~ '^[0-9]{5,30}$'),
  phone_number_id text NOT NULL,
  uploaded_by_auth_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, media_id)
);

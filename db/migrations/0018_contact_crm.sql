-- Contacts CRM: groups with membership, typed custom field definitions and per-contact opt-in state.

ALTER TABLE app_inbox_contacts
  ADD COLUMN IF NOT EXISTS consent_status text NOT NULL DEFAULT 'subscribed'
    CHECK (consent_status IN ('subscribed', 'unsubscribed')),
  ADD COLUMN IF NOT EXISTS consent_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS app_inbox_contacts_consent_idx
  ON app_inbox_contacts (workspace_id, consent_status);

CREATE INDEX IF NOT EXISTS app_inbox_contacts_name_idx
  ON app_inbox_contacts (workspace_id, name, id);

CREATE TABLE IF NOT EXISTS app_contact_groups (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  created_by_auth_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS app_contact_groups_name_idx
  ON app_contact_groups (workspace_id, lower(name));

CREATE TABLE IF NOT EXISTS app_contact_group_members (
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  group_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, group_id, contact_id),
  FOREIGN KEY (workspace_id, group_id) REFERENCES app_contact_groups(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, contact_id) REFERENCES app_inbox_contacts(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS app_contact_group_members_contact_idx
  ON app_contact_group_members (workspace_id, contact_id);

CREATE TABLE IF NOT EXISTS app_contact_field_definitions (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  field_key text NOT NULL CHECK (field_key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  field_type text NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'choice')),
  choices jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(choices) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (field_type <> 'choice' OR jsonb_array_length(choices) > 0),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, field_key)
);

-- Click-to-WhatsApp ads: referral attribution per inbound message, and the opt-in ad account connection.
-- Additive only. The connection stores only the read scope (ads_read), enforced by a CHECK.

-- One row per inbound message that carried a Meta `referral` object (a click-to-WhatsApp ad or post).
-- The Meta message id makes webhook retries idempotent. Attribution is kept per contact, so the
-- latest referral for a contact is the one ordered first by referred_at.
CREATE TABLE IF NOT EXISTS app_ad_attributions (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  wam_id text NOT NULL CHECK (char_length(wam_id) BETWEEN 1 AND 200),
  source_type text NOT NULL CHECK (source_type IN ('ad', 'post')),
  source_id text NOT NULL CHECK (char_length(source_id) BETWEEN 1 AND 64),
  source_url text CHECK (source_url IS NULL OR char_length(source_url) <= 1000),
  headline text NOT NULL DEFAULT '' CHECK (char_length(headline) <= 300),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 1000),
  media_type text NOT NULL DEFAULT '' CHECK (char_length(media_type) <= 20),
  ctwa_clid text CHECK (ctwa_clid IS NULL OR char_length(ctwa_clid) <= 512),
  referred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, wam_id),
  FOREIGN KEY (workspace_id, contact_id) REFERENCES app_inbox_contacts(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS app_ad_attributions_contact_idx
  ON app_ad_attributions (workspace_id, contact_id, referred_at DESC);

CREATE INDEX IF NOT EXISTS app_ad_attributions_source_idx
  ON app_ad_attributions (workspace_id, source_id, referred_at DESC);

-- One ad account connection per workspace. The access token is encrypted with the app's AES-256-GCM helper.
-- `scope` can only ever be 'ads_read': the app never requests ads_management and this row cannot record it.
CREATE TABLE IF NOT EXISTS app_ad_account_connections (
  workspace_id uuid PRIMARY KEY REFERENCES app_workspaces(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected')),
  scope text NOT NULL DEFAULT 'ads_read' CHECK (scope = 'ads_read'),
  meta_user_id text NOT NULL DEFAULT '' CHECK (char_length(meta_user_id) <= 64),
  ad_accounts jsonb NOT NULL DEFAULT '[]'::jsonb,
  encrypted_access_token text,
  access_token_iv text,
  access_token_tag text,
  token_expires_at timestamptz,
  connected_by_auth_user_id text NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    status = 'disconnected'
    OR (encrypted_access_token IS NOT NULL AND access_token_iv IS NOT NULL AND access_token_tag IS NOT NULL)
  )
);

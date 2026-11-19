-- Meta commerce catalog sync. One Meta catalog per workspace, linked to the workspace's WABA.
-- Products are pushed to Meta; nothing is deleted in Meta. Sync items record what was last sent.
CREATE TABLE IF NOT EXISTS app_meta_catalog_links (
  workspace_id uuid PRIMARY KEY REFERENCES app_workspaces(id) ON DELETE CASCADE,
  meta_catalog_id text,
  waba_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'linked', 'error')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_meta_catalog_sync_items (
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  meta_retailer_id text NOT NULL,
  last_hash text,
  last_synced_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'skipped', 'error')),
  error text,
  PRIMARY KEY (workspace_id, product_id)
);

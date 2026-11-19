-- Product catalogue for a workspace. Products are never hard-deleted from the
-- app: disabling sets active = false so past conversations keep their context.
CREATE TABLE IF NOT EXISTS app_catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  price_inr numeric(12,2) NOT NULL CHECK (price_inr >= 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  image_url text CHECK (image_url IS NULL OR image_url ~ '^https://'),
  sku text CHECK (sku IS NULL OR (char_length(sku) <= 64 AND sku ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$')),
  in_stock boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_catalog_products_sku_idx
  ON app_catalog_products (workspace_id, sku) WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS app_catalog_products_workspace_active_idx
  ON app_catalog_products (workspace_id, active);

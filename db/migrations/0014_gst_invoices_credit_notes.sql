-- GST capture and invoicing. Amounts are INR paise. Invoices are immutable once issued;
-- corrections are made with credit notes, never by editing an invoice.

CREATE TABLE IF NOT EXISTS app_billing_tax_profiles (
  workspace_id uuid PRIMARY KEY REFERENCES app_workspaces(id) ON DELETE CASCADE,
  legal_name text NOT NULL CHECK (length(legal_name) BETWEEN 2 AND 200),
  gstin text CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  state_code text NOT NULL CHECK (state_code ~ '^[0-9]{2}$'),
  address text NOT NULL CHECK (length(address) BETWEEN 5 AND 500),
  updated_by_auth_user_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_billing_invoice_sequences (
  series text NOT NULL,
  financial_year text NOT NULL,
  last_number integer NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  PRIMARY KEY (series, financial_year)
);

CREATE TABLE IF NOT EXISTS app_billing_invoices (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  order_id uuid NOT NULL UNIQUE REFERENCES app_billing_orders(id),
  invoice_number text NOT NULL UNIQUE,
  financial_year text NOT NULL,
  buyer_legal_name text NOT NULL,
  buyer_gstin text,
  buyer_state_code text NOT NULL,
  buyer_address text NOT NULL,
  seller_gstin text NOT NULL,
  seller_state_code text NOT NULL,
  sac_code text NOT NULL,
  rate_percent integer NOT NULL CHECK (rate_percent > 0),
  base_paise integer NOT NULL CHECK (base_paise > 0),
  cgst_paise integer NOT NULL CHECK (cgst_paise >= 0),
  sgst_paise integer NOT NULL CHECK (sgst_paise >= 0),
  igst_paise integer NOT NULL CHECK (igst_paise >= 0),
  total_paise integer NOT NULL CHECK (total_paise > 0),
  issued_at timestamptz NOT NULL DEFAULT now(),
  CHECK (total_paise = base_paise + cgst_paise + sgst_paise + igst_paise),
  CHECK ((cgst_paise + sgst_paise = 0) OR (igst_paise = 0))
);

CREATE TABLE IF NOT EXISTS app_billing_credit_notes (
  id uuid PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES app_billing_invoices(id),
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  credit_note_number text NOT NULL UNIQUE,
  financial_year text NOT NULL,
  reason text NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
  base_paise integer NOT NULL CHECK (base_paise >= 0),
  cgst_paise integer NOT NULL CHECK (cgst_paise >= 0),
  sgst_paise integer NOT NULL CHECK (sgst_paise >= 0),
  igst_paise integer NOT NULL CHECK (igst_paise >= 0),
  gross_paise integer NOT NULL CHECK (gross_paise > 0),
  issued_by_auth_user_id text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_billing_credit_notes_invoice_idx ON app_billing_credit_notes (invoice_id);

ALTER TABLE app_billing_orders
  ADD COLUMN IF NOT EXISTS base_paise integer,
  ADD COLUMN IF NOT EXISTS gst_paise integer,
  ADD COLUMN IF NOT EXISTS buyer_state_code text,
  ADD COLUMN IF NOT EXISTS buyer_gstin text;

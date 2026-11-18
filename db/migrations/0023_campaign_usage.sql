-- Monthly rollup of accepted campaign sends per workspace, for the Campaigns add-on.
-- month is the Asia/Kolkata calendar month as YYYY-MM. Written by recordCampaignSends.
CREATE TABLE IF NOT EXISTS app_campaign_usage_monthly (
  workspace_id uuid NOT NULL REFERENCES app_workspaces(id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  sends integer NOT NULL DEFAULT 0 CHECK (sends >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, month)
);

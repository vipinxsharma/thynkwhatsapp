-- Send log for campaigns: one durable row per Meta send attempt, so every outcome is kept
-- and the rolling 24-hour pacing cap can be counted from the database.
-- outcome: accepted (Meta returned a message ID), rejected (Meta refused before accepting),
-- uncertain (no usable answer; the recipient is never retried).

CREATE TABLE IF NOT EXISTS app_campaign_send_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES app_campaigns(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES app_campaign_recipients(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL CHECK (outcome IN ('accepted', 'rejected', 'uncertain')),
  http_status integer,
  meta_code integer,
  error text
);

CREATE INDEX IF NOT EXISTS app_campaign_send_attempts_campaign_idx
  ON app_campaign_send_attempts (campaign_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS app_campaign_send_attempts_time_idx
  ON app_campaign_send_attempts (attempted_at);

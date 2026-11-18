-- Business tokens issued by the Embedded Signup login configuration expire after 60 days.
-- Track what Meta reports so a scheduled job can refresh them before they lapse.
-- token_checked_at IS NOT NULL with token_expires_at IS NULL means "never expires".
ALTER TABLE app_waba_connections
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_refresh_error text;

CREATE INDEX IF NOT EXISTS app_waba_connections_token_expiry_idx
  ON app_waba_connections (token_expires_at)
  WHERE status = 'connected';

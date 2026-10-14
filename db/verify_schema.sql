DO $$
DECLARE
  expected_table text;
BEGIN
  FOREACH expected_table IN ARRAY ARRAY[
    'app_workspaces',
    'app_workspace_members',
    'app_audit_logs',
    'app_waba_connections',
    'app_support_cases',
    'app_support_messages',
    'app_support_email_outbox',
    'app_support_knowledge',
    'app_support_ai_runs',
    'app_workspace_invitations',
    'app_inbox_contacts',
    'app_inbox_conversations',
    'app_inbox_messages',
    'app_outbound_requests',
    'app_sms_dlt_drafts'
  ] LOOP
    IF to_regclass('public.' || expected_table) IS NULL THEN
      RAISE EXCEPTION 'Missing application table: %', expected_table;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.app_waba_connections'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (waba_id)'
  ) THEN
    RAISE EXCEPTION 'WABA ID uniqueness constraint is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'app_workspace_invitations'
      AND indexname = 'app_workspace_invitations_pending_email_idx'
  ) THEN
    RAISE EXCEPTION 'Pending invitation uniqueness index is missing';
  END IF;
END $$;

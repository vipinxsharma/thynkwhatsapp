-- Campaign sending (migration 0015): consent gating when recipients are created,
-- one recipient per contact per campaign, forward-only delivery receipts, and
-- recipient counts. Isolated fixtures; everything rolls back at the end.
BEGIN;

INSERT INTO app_workspaces(id,name,slug,created_by_auth_user_id)
VALUES ('c0a1e000-0000-4000-8000-000000000001','Campaign QA','campaign-qa-c0a1e000','qa');

INSERT INTO app_inbox_contacts(id,workspace_id,wa_id,phone_number,name,tags) VALUES
  ('c0a1e000-0000-4000-8000-000000000011','c0a1e000-0000-4000-8000-000000000001','15555550011','+15555550011','Opted In','["Campaign"]'),
  ('c0a1e000-0000-4000-8000-000000000012','c0a1e000-0000-4000-8000-000000000001','15555550012','+15555550012','Opted Out','["Campaign"]'),
  ('c0a1e000-0000-4000-8000-000000000013','c0a1e000-0000-4000-8000-000000000001','15555550013','+15555550013','No Consent','["Campaign"]'),
  ('c0a1e000-0000-4000-8000-000000000014','c0a1e000-0000-4000-8000-000000000001','15555550014','+15555550014','Second Opted In','["Campaign"]');

INSERT INTO app_contact_marketing_consent(workspace_id,contact_id,status,source,recorded_by_auth_user_id) VALUES
  ('c0a1e000-0000-4000-8000-000000000001','c0a1e000-0000-4000-8000-000000000011','opted_in','manual','qa'),
  ('c0a1e000-0000-4000-8000-000000000001','c0a1e000-0000-4000-8000-000000000012','opted_out','manual','qa'),
  ('c0a1e000-0000-4000-8000-000000000001','c0a1e000-0000-4000-8000-000000000014','opted_in','inbound_keyword','qa');

INSERT INTO app_campaigns(id,workspace_id,name,phone_number_id,waba_id,template_name,template_language,status,created_by_auth_user_id)
VALUES ('c0a1e000-0000-4000-8000-0000000000c1','c0a1e000-0000-4000-8000-000000000001','QA campaign','1234567','waba-qa','promo','en','sending','qa');

-- Same selection rule as createCampaign in lib/campaigns/store.ts: only opted-in contacts.
INSERT INTO app_campaign_recipients (workspace_id, campaign_id, contact_id, wa_id, contact_name)
SELECT c.workspace_id, 'c0a1e000-0000-4000-8000-0000000000c1'::uuid, c.id, c.wa_id, c.name
FROM app_inbox_contacts c
JOIN app_contact_marketing_consent m
  ON m.workspace_id = c.workspace_id AND m.contact_id = c.id AND m.status = 'opted_in'
WHERE c.workspace_id = 'c0a1e000-0000-4000-8000-000000000001'::uuid AND c.tags ? 'Campaign';

-- (a) Recipients exist only for opted-in contacts.
DO $$ BEGIN
  IF (SELECT count(*) FROM app_campaign_recipients WHERE campaign_id='c0a1e000-0000-4000-8000-0000000000c1')<>2 THEN
    RAISE EXCEPTION 'Expected exactly the two opted-in contacts as recipients';
  END IF;
  IF EXISTS (SELECT 1 FROM app_campaign_recipients WHERE campaign_id='c0a1e000-0000-4000-8000-0000000000c1'
             AND contact_id IN ('c0a1e000-0000-4000-8000-000000000012','c0a1e000-0000-4000-8000-000000000013')) THEN
    RAISE EXCEPTION 'Opted-out or no-consent contact received a recipient row';
  END IF;
END $$;

-- (b) A second recipient row for the same contact in the same campaign is rejected.
DO $$ BEGIN
  BEGIN
    INSERT INTO app_campaign_recipients (workspace_id, campaign_id, contact_id, wa_id, contact_name)
    VALUES ('c0a1e000-0000-4000-8000-000000000001','c0a1e000-0000-4000-8000-0000000000c1',
            'c0a1e000-0000-4000-8000-000000000011','15555550011','Opted In');
    RAISE EXCEPTION 'Duplicate recipient for the same contact was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL; -- expected
  END;
END $$;

-- (c) Delivery receipts move forward only. Mirrors applyDeliveryReceipt in store.ts.
CREATE FUNCTION qa_apply_receipt(p_ws uuid, p_wam text, p_status text, p_error text) RETURNS void
LANGUAGE sql AS $$
  UPDATE app_campaign_recipients SET status = p_status,
    error = CASE WHEN p_status = 'failed' THEN p_error ELSE error END, updated_at = now()
  WHERE workspace_id = p_ws AND wam_id = p_wam
    AND (
      (p_status = 'failed' AND status = 'sent')
      OR (p_status <> 'failed' AND
        (CASE status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 99 END)
        < (CASE p_status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END))
    )
$$;

UPDATE app_campaign_recipients SET status='sent', wam_id='wam-qa-1'
  WHERE campaign_id='c0a1e000-0000-4000-8000-0000000000c1' AND contact_id='c0a1e000-0000-4000-8000-000000000011';
UPDATE app_campaign_recipients SET status='sent', wam_id='wam-qa-2'
  WHERE campaign_id='c0a1e000-0000-4000-8000-0000000000c1' AND contact_id='c0a1e000-0000-4000-8000-000000000014';

DO $$ BEGIN PERFORM qa_apply_receipt('c0a1e000-0000-4000-8000-000000000001','wam-qa-1','delivered',NULL); END $$;
DO $$ BEGIN
  IF (SELECT status FROM app_campaign_recipients WHERE wam_id='wam-qa-1')<>'delivered' THEN RAISE EXCEPTION 'sent -> delivered not applied'; END IF;
END $$;

DO $$ BEGIN PERFORM qa_apply_receipt('c0a1e000-0000-4000-8000-000000000001','wam-qa-1','sent',NULL); END $$;
DO $$ BEGIN
  IF (SELECT status FROM app_campaign_recipients WHERE wam_id='wam-qa-1')<>'delivered' THEN RAISE EXCEPTION 'delivered moved back to sent'; END IF;
END $$;

DO $$ BEGIN PERFORM qa_apply_receipt('c0a1e000-0000-4000-8000-000000000001','wam-qa-1','read',NULL); END $$;
DO $$ BEGIN
  IF (SELECT status FROM app_campaign_recipients WHERE wam_id='wam-qa-1')<>'read' THEN RAISE EXCEPTION 'delivered -> read not applied'; END IF;
END $$;

DO $$ BEGIN PERFORM qa_apply_receipt('c0a1e000-0000-4000-8000-000000000001','wam-qa-1','delivered',NULL); END $$;
DO $$ BEGIN
  IF (SELECT status FROM app_campaign_recipients WHERE wam_id='wam-qa-1')<>'read' THEN RAISE EXCEPTION 'read moved back to delivered'; END IF;
END $$;

-- A late "failed" must not overwrite a recipient that already reached the device.
DO $$ BEGIN PERFORM qa_apply_receipt('c0a1e000-0000-4000-8000-000000000001','wam-qa-1','failed','late failure'); END $$;
DO $$ BEGIN
  IF (SELECT status FROM app_campaign_recipients WHERE wam_id='wam-qa-1')<>'read' THEN RAISE EXCEPTION 'read overwritten by failed'; END IF;
END $$;

-- "failed" is accepted while the recipient is still at sent.
DO $$ BEGIN PERFORM qa_apply_receipt('c0a1e000-0000-4000-8000-000000000001','wam-qa-2','failed','Meta refused'); END $$;
DO $$ BEGIN
  IF (SELECT status||'|'||error FROM app_campaign_recipients WHERE wam_id='wam-qa-2')<>'failed|Meta refused' THEN
    RAISE EXCEPTION 'sent -> failed not applied';
  END IF;
END $$;

-- (d) Recipient counts add up.
DO $$ DECLARE total int; by_status int; BEGIN
  SELECT count(*) INTO total FROM app_campaign_recipients WHERE campaign_id='c0a1e000-0000-4000-8000-0000000000c1';
  SELECT coalesce(sum(n),0) INTO by_status FROM (
    SELECT count(*) AS n FROM app_campaign_recipients WHERE campaign_id='c0a1e000-0000-4000-8000-0000000000c1' GROUP BY status
  ) g;
  IF total<>2 OR by_status<>total THEN RAISE EXCEPTION 'Status counts do not add up to recipients (total %, by status %)', total, by_status; END IF;
  IF (SELECT count(*) FROM app_campaign_recipients WHERE campaign_id='c0a1e000-0000-4000-8000-0000000000c1' AND status='read')<>1
     OR (SELECT count(*) FROM app_campaign_recipients WHERE campaign_id='c0a1e000-0000-4000-8000-0000000000c1' AND status='failed')<>1 THEN
    RAISE EXCEPTION 'Per-status counts are wrong';
  END IF;
END $$;

ROLLBACK;

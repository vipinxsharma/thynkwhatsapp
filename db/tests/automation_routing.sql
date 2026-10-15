-- Isolated fixtures; all changes roll back after assertions.
BEGIN;
INSERT INTO app_workspaces(id,name,slug,created_by_auth_user_id) VALUES ('3a6343e2-5a09-442e-9d6c-1040a6de5f98','Routing QA','routing-3a6343e2-5a09-442e-9d6c-1040a6de5f98','qa');
INSERT INTO app_inbox_contacts(id,workspace_id,wa_id,phone_number,name,tags) VALUES ('ba995df2-8593-4a5f-b256-63c863baf14a','3a6343e2-5a09-442e-9d6c-1040a6de5f98','15555550001','+15555550001','QA','["Existing"]');
INSERT INTO app_inbox_conversations(id,workspace_id,contact_id,phone_number_id) VALUES ('5e5b4c26-741e-4818-bb4f-b6b5a0a4fd32','3a6343e2-5a09-442e-9d6c-1040a6de5f98','ba995df2-8593-4a5f-b256-63c863baf14a','1234567');
INSERT INTO app_inbox_messages(id,workspace_id,conversation_id,wam_id,direction,type,body,status,timestamp) VALUES ('e4d30f2c-f318-49f4-a42c-2290e6dcc332','3a6343e2-5a09-442e-9d6c-1040a6de5f98','5e5b4c26-741e-4818-bb4f-b6b5a0a4fd32','routing-qa','inbound','text','help','received',now());
INSERT INTO app_automation_rules(id,workspace_id,name,match_type,keywords,tags,conversation_status,enabled,created_by,updated_at) VALUES ('50533d3f-151e-40ac-9b9e-c166cb2b607e','3a6343e2-5a09-442e-9d6c-1040a6de5f98','QA','contains','["help"]','["Support"]','pending',true,'qa','2026-10-15T00:00:00Z');
WITH claimed AS (
    INSERT INTO app_automation_runs (id,workspace_id,rule_id,rule_name,wam_id,conversation_id,applied_actions)
    SELECT '71fc5ce4-a65a-4ec8-b33f-ebca5cc97e0b'::uuid,'3a6343e2-5a09-442e-9d6c-1040a6de5f98'::uuid,'50533d3f-151e-40ac-9b9e-c166cb2b607e'::uuid,'QA','routing-qa',c.id,'{"tags": ["Support"], "conversationStatus": "pending"}'::jsonb
    FROM app_inbox_conversations c
    JOIN app_inbox_messages m ON m.workspace_id=c.workspace_id AND m.conversation_id=c.id AND m.wam_id='routing-qa' AND m.direction='inbound'
    WHERE c.workspace_id='3a6343e2-5a09-442e-9d6c-1040a6de5f98'::uuid AND c.id='5e5b4c26-741e-4818-bb4f-b6b5a0a4fd32'::uuid AND c.phone_number_id='1234567'
      AND m.timestamp >= now() - interval '24 hours'
      AND EXISTS (SELECT 1 FROM app_automation_rules r WHERE r.workspace_id='3a6343e2-5a09-442e-9d6c-1040a6de5f98'::uuid AND r.id='50533d3f-151e-40ac-9b9e-c166cb2b607e'::uuid AND r.enabled AND r.updated_at='2026-10-15T00:00:00Z'::timestamptz)
    ON CONFLICT (workspace_id,wam_id) DO NOTHING RETURNING conversation_id
  ), updated_conversation AS (
    UPDATE app_inbox_conversations c SET status=COALESCE('pending',status),updated_at=now()
    FROM claimed WHERE c.workspace_id='3a6343e2-5a09-442e-9d6c-1040a6de5f98'::uuid AND c.id=claimed.conversation_id RETURNING c.contact_id
  ) UPDATE app_inbox_contacts contact SET tags=(SELECT COALESCE(jsonb_agg(DISTINCT tag),'[]'::jsonb)
      FROM jsonb_array_elements_text(contact.tags || '["Support"]'::jsonb) AS items(tag)),updated_at=now()
    WHERE contact.workspace_id='3a6343e2-5a09-442e-9d6c-1040a6de5f98'::uuid AND contact.id IN (SELECT contact_id FROM updated_conversation) RETURNING contact.id;
WITH claimed AS (
    INSERT INTO app_automation_runs (id,workspace_id,rule_id,rule_name,wam_id,conversation_id,applied_actions)
    SELECT '71fc5ce4-a65a-4ec8-b33f-ebca5cc97e0b'::uuid,'3a6343e2-5a09-442e-9d6c-1040a6de5f98'::uuid,'50533d3f-151e-40ac-9b9e-c166cb2b607e'::uuid,'QA','routing-qa',c.id,'{"tags": ["Support"], "conversationStatus": "pending"}'::jsonb
    FROM app_inbox_conversations c
    JOIN app_inbox_messages m ON m.workspace_id=c.workspace_id AND m.conversation_id=c.id AND m.wam_id='routing-qa' AND m.direction='inbound'
    WHERE c.workspace_id='3a6343e2-5a09-442e-9d6c-1040a6de5f98'::uuid AND c.id='5e5b4c26-741e-4818-bb4f-b6b5a0a4fd32'::uuid AND c.phone_number_id='1234567'
      AND m.timestamp >= now() - interval '24 hours'
      AND EXISTS (SELECT 1 FROM app_automation_rules r WHERE r.workspace_id='3a6343e2-5a09-442e-9d6c-1040a6de5f98'::uuid AND r.id='50533d3f-151e-40ac-9b9e-c166cb2b607e'::uuid AND r.enabled AND r.updated_at='2026-10-15T00:00:00Z'::timestamptz)
    ON CONFLICT (workspace_id,wam_id) DO NOTHING RETURNING conversation_id
  ), updated_conversation AS (
    UPDATE app_inbox_conversations c SET status=COALESCE('pending',status),updated_at=now()
    FROM claimed WHERE c.workspace_id='3a6343e2-5a09-442e-9d6c-1040a6de5f98'::uuid AND c.id=claimed.conversation_id RETURNING c.contact_id
  ) UPDATE app_inbox_contacts contact SET tags=(SELECT COALESCE(jsonb_agg(DISTINCT tag),'[]'::jsonb)
      FROM jsonb_array_elements_text(contact.tags || '["Support"]'::jsonb) AS items(tag)),updated_at=now()
    WHERE contact.workspace_id='3a6343e2-5a09-442e-9d6c-1040a6de5f98'::uuid AND contact.id IN (SELECT contact_id FROM updated_conversation) RETURNING contact.id;
WITH claimed AS (
    INSERT INTO app_automation_runs (id,workspace_id,rule_id,rule_name,wam_id,conversation_id,applied_actions)
    SELECT '71fc5ce4-a65a-4ec8-b33f-ebca5cc97e0b'::uuid,'d9fdc2b7-99a8-4ad7-91bb-a7754eb3184a'::uuid,'50533d3f-151e-40ac-9b9e-c166cb2b607e'::uuid,'QA','routing-qa',c.id,'{"tags": ["Support"], "conversationStatus": "pending"}'::jsonb
    FROM app_inbox_conversations c
    JOIN app_inbox_messages m ON m.workspace_id=c.workspace_id AND m.conversation_id=c.id AND m.wam_id='routing-qa' AND m.direction='inbound'
    WHERE c.workspace_id='d9fdc2b7-99a8-4ad7-91bb-a7754eb3184a'::uuid AND c.id='5e5b4c26-741e-4818-bb4f-b6b5a0a4fd32'::uuid AND c.phone_number_id='1234567'
      AND m.timestamp >= now() - interval '24 hours'
      AND EXISTS (SELECT 1 FROM app_automation_rules r WHERE r.workspace_id='d9fdc2b7-99a8-4ad7-91bb-a7754eb3184a'::uuid AND r.id='50533d3f-151e-40ac-9b9e-c166cb2b607e'::uuid AND r.enabled AND r.updated_at='2026-10-15T00:00:00Z'::timestamptz)
    ON CONFLICT (workspace_id,wam_id) DO NOTHING RETURNING conversation_id
  ), updated_conversation AS (
    UPDATE app_inbox_conversations c SET status=COALESCE('pending',status),updated_at=now()
    FROM claimed WHERE c.workspace_id='d9fdc2b7-99a8-4ad7-91bb-a7754eb3184a'::uuid AND c.id=claimed.conversation_id RETURNING c.contact_id
  ) UPDATE app_inbox_contacts contact SET tags=(SELECT COALESCE(jsonb_agg(DISTINCT tag),'[]'::jsonb)
      FROM jsonb_array_elements_text(contact.tags || '["Support"]'::jsonb) AS items(tag)),updated_at=now()
    WHERE contact.workspace_id='d9fdc2b7-99a8-4ad7-91bb-a7754eb3184a'::uuid AND contact.id IN (SELECT contact_id FROM updated_conversation) RETURNING contact.id;
DO $$ BEGIN
 IF (SELECT count(*) FROM app_automation_runs WHERE workspace_id='3a6343e2-5a09-442e-9d6c-1040a6de5f98')<>1 THEN RAISE EXCEPTION 'Duplicate run'; END IF;
 IF (SELECT status FROM app_inbox_conversations WHERE id='5e5b4c26-741e-4818-bb4f-b6b5a0a4fd32')<>'pending' THEN RAISE EXCEPTION 'Status not applied'; END IF;
 IF NOT (SELECT tags @> '["Existing","Support"]'::jsonb AND jsonb_array_length(tags)=2 FROM app_inbox_contacts WHERE id='ba995df2-8593-4a5f-b256-63c863baf14a') THEN RAISE EXCEPTION 'Tags not merged'; END IF;
END $$;
ROLLBACK;

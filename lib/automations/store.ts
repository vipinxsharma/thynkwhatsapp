import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { matchRoutingRule, type RoutingInput, type RoutingRule } from "./routing";
function db() {
  if (!process.env.DATABASE_URL) throw new Error("Automation storage is not configured");
  return neon(process.env.DATABASE_URL);
}
const columns = `id, name, channel_id AS "channelId", match_type AS "matchType", keywords, tags,
 conversation_status AS "conversationStatus", priority, enabled, updated_at AS "updatedAt"`;
export async function listRoutingRules(workspaceId: string): Promise<RoutingRule[]> {
  return await db().query(`SELECT ${columns} FROM app_automation_rules WHERE workspace_id=$1::uuid ORDER BY priority, id`, [workspaceId]) as RoutingRule[];
}
export async function listRoutingRuns(workspaceId: string) {
  return db().query(`SELECT id, rule_name AS "ruleName", conversation_id AS "conversationId",
    applied_actions AS actions, created_at AS "createdAt" FROM app_automation_runs WHERE workspace_id=$1::uuid ORDER BY created_at DESC LIMIT 50`, [workspaceId]);
}
export async function saveRoutingRule(workspaceId: string, userId: string, input: RoutingInput, id?: string) {
  const sql = db();
  if (input.channelId) {
    const channel = await sql.query(`SELECT id FROM app_whatsapp_channels WHERE workspace_id=$1::uuid AND phone_number_id=$2 AND enabled`, [workspaceId, input.channelId]);
    if (!channel.length) throw new Error("Selected channel is not connected to this workspace");
  }
  const values = [workspaceId, input.name, input.channelId, input.matchType, JSON.stringify(input.keywords), JSON.stringify(input.tags), input.conversationStatus, input.priority, input.enabled];
  const rows = id
    ? await sql.query(`UPDATE app_automation_rules SET name=$2,channel_id=$3,match_type=$4,keywords=$5::jsonb,tags=$6::jsonb,
        conversation_status=$7,priority=$8,enabled=$9,updated_at=now() WHERE workspace_id=$1::uuid AND id=$10::uuid RETURNING ${columns}`, [...values, id])
    : await sql.query(`INSERT INTO app_automation_rules (workspace_id,name,channel_id,match_type,keywords,tags,conversation_status,priority,enabled,id,created_by)
        VALUES ($1::uuid,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10::uuid,$11) RETURNING ${columns}`, [...values, randomUUID(), userId]);
  return rows[0] || null;
}
export async function deleteRoutingRule(workspaceId: string, id: string) {
  return (await db().query(`DELETE FROM app_automation_rules WHERE workspace_id=$1::uuid AND id=$2::uuid RETURNING id`, [workspaceId,id])).length > 0;
}
/** Internal actions only. One committed execution per inbound message, including webhook retries. */
export async function routeInboundMessage(workspaceId: string, conversationId: string, wamId: string, channelId: string, text: string) {
  const rule = matchRoutingRule(await listRoutingRules(workspaceId), text, channelId);
  if (!rule) return null;
  const actions = { tags: rule.tags, conversationStatus: rule.conversationStatus };
  const rows = await db().query(`WITH claimed AS (
    INSERT INTO app_automation_runs (id,workspace_id,rule_id,rule_name,wam_id,conversation_id,applied_actions)
    SELECT $1::uuid,$2::uuid,$3::uuid,$4,$5,c.id,$6::jsonb
    FROM app_inbox_conversations c
    JOIN app_inbox_messages m ON m.workspace_id=c.workspace_id AND m.conversation_id=c.id AND m.wam_id=$5 AND m.direction='inbound'
    WHERE c.workspace_id=$2::uuid AND c.id=$7::uuid AND c.phone_number_id=$10
      AND m.timestamp >= now() - interval '24 hours' AND m.timestamp <= now() + interval '5 minutes'
      AND EXISTS (SELECT 1 FROM app_automation_rules r WHERE r.workspace_id=$2::uuid AND r.id=$3::uuid AND r.enabled AND r.updated_at=$11::timestamptz)
    ON CONFLICT (workspace_id,wam_id) DO NOTHING RETURNING conversation_id
  ), updated_conversation AS (
    UPDATE app_inbox_conversations c SET status=COALESCE($8,status),updated_at=now()
    FROM claimed WHERE c.workspace_id=$2::uuid AND c.id=claimed.conversation_id RETURNING c.contact_id
  ) UPDATE app_inbox_contacts contact SET tags=(SELECT COALESCE(jsonb_agg(DISTINCT tag),'[]'::jsonb)
      FROM jsonb_array_elements_text(contact.tags || $9::jsonb) AS items(tag)),updated_at=now()
    WHERE contact.workspace_id=$2::uuid AND contact.id IN (SELECT contact_id FROM updated_conversation) RETURNING contact.id`,
    [randomUUID(),workspaceId,rule.id,rule.name,wamId,JSON.stringify(actions),conversationId,rule.conversationStatus,JSON.stringify(rule.tags),channelId,rule.updatedAt]);
  return rows.length ? rule.id : null;
}

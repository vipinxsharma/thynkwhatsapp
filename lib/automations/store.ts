import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { matchRoutingRule, type RoutingInput, type RoutingRule } from "./routing";
import {
  BOT_REPLY_COOLDOWN_MS,
  BOT_ECHO_WINDOW_MS,
  isBotEcho,
  renderPlaceholders,
  sanitizeTemplateParameter,
  type ReplyCandidates,
} from "./reply";
function db() {
  if (!process.env.DATABASE_URL) throw new Error("Automation storage is not configured");
  return neon(process.env.DATABASE_URL);
}
const columns = `id, name, channel_id AS "channelId", match_type AS "matchType", keywords, tags,
 conversation_status AS "conversationStatus", priority, enabled, updated_at AS "updatedAt",
 reply_text AS "replyText", reply_template_name AS "replyTemplateName",
 reply_template_language AS "replyTemplateLanguage", reply_template_variables AS "replyTemplateVariables"`;
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
    const channel = await sql.query(`SELECT phone_number_id FROM app_whatsapp_channels WHERE workspace_id=$1::uuid AND phone_number_id=$2 AND enabled`, [workspaceId, input.channelId]);
    if (!channel.length) throw new Error("Selected channel is not connected to this workspace");
  }
  const values = [workspaceId, input.name, input.channelId, input.matchType, JSON.stringify(input.keywords), JSON.stringify(input.tags), input.conversationStatus, input.priority, input.enabled,
    input.replyText, input.replyTemplateName, input.replyTemplateLanguage, JSON.stringify(input.replyTemplateVariables)];
  const rows = id
    ? await sql.query(`UPDATE app_automation_rules SET name=$2,channel_id=$3,match_type=$4,keywords=$5::jsonb,tags=$6::jsonb,
        conversation_status=$7,priority=$8,enabled=$9,reply_text=$10,reply_template_name=$11,reply_template_language=$12,
        reply_template_variables=$13::jsonb,updated_at=now() WHERE workspace_id=$1::uuid AND id=$14::uuid RETURNING ${columns}`, [...values, id])
    : await sql.query(`INSERT INTO app_automation_rules (workspace_id,name,channel_id,match_type,keywords,tags,conversation_status,priority,enabled,reply_text,reply_template_name,reply_template_language,reply_template_variables,id,created_by)
        VALUES ($1::uuid,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::uuid,$15) RETURNING ${columns}`, [...values, randomUUID(), userId]);
  return rows[0] || null;
}
export async function deleteRoutingRule(workspaceId: string, id: string) {
  return (await db().query(`DELETE FROM app_automation_rules WHERE workspace_id=$1::uuid AND id=$2::uuid RETURNING id`, [workspaceId,id])).length > 0;
}

export interface ContactForReply {
  /** Contact name as stored. Digits-only names (no profile name) are treated as unknown. */
  name: string;
  /** Contact number in E.164 form, e.g. +919876543210. */
  phone: string;
}

export interface AutomationRun {
  runId: string;
  ruleId: string;
  ruleName: string;
  /** Rendered reply for this contact, or null when the rule sends no reply or the reply was held back. */
  reply: ReplyCandidates | null;
}

/** Bot replies sent recently in a conversation. Used by the loop guard. */
async function recentBotReplies(workspaceId: string, conversationId: string): Promise<Array<{ text: string; cooling: boolean }>> {
  const rows = await db().query(
    `SELECT applied_actions->'reply'->>'text' AS text,
       (created_at > now() - ($3::int * interval '1 millisecond')) AS cooling
     FROM app_automation_runs
     WHERE workspace_id = $1::uuid AND conversation_id = $2::uuid
       AND applied_actions->'reply' IS NOT NULL AND jsonb_typeof(applied_actions->'reply') = 'object'
       AND created_at > now() - ($4::int * interval '1 millisecond')
     ORDER BY created_at DESC LIMIT 20`,
    [workspaceId, conversationId, BOT_REPLY_COOLDOWN_MS, BOT_ECHO_WINDOW_MS]
  ) as Array<{ text: string | null; cooling: boolean }>;
  return rows.map((row) => ({ text: row.text || "", cooling: Boolean(row.cooling) }));
}

/**
 * Applies the first matching rule once per inbound message. The run row is the claim: a webhook
 * retry for the same wam_id cannot apply the rule or plan a second reply.
 * Bot replies are never routed again, and a message that echoes a recent bot reply is not routed.
 */
export async function routeInboundMessage(
  workspaceId: string,
  conversationId: string,
  wamId: string,
  channelId: string,
  text: string,
  contact: ContactForReply & { handedOver: boolean },
): Promise<AutomationRun | null> {
  const rule = matchRoutingRule(await listRoutingRules(workspaceId), text, channelId);
  if (!rule) return null;

  let reply: ReplyCandidates | null = null;
  let replySkipped: "handed_over" | "echo" | "cooldown" | null = null;
  if (rule.replyText || rule.replyTemplateName) {
    const recent = await recentBotReplies(workspaceId, conversationId);
    if (contact.handedOver) replySkipped = "handed_over";
    else if (isBotEcho(text, recent.map((item) => item.text))) replySkipped = "echo";
    else if (recent.some((item) => item.cooling)) replySkipped = "cooldown";
    else {
      const values = { name: contact.name, phone: contact.phone };
      reply = {
        text: rule.replyText ? renderPlaceholders(rule.replyText, values) : null,
        templateName: rule.replyTemplateName,
        templateLanguage: rule.replyTemplateLanguage,
        templateVariables: rule.replyTemplateVariables.map((item) => sanitizeTemplateParameter(renderPlaceholders(item, values))),
      };
    }
  }

  const runId = randomUUID();
  const actions = { tags: rule.tags, conversationStatus: rule.conversationStatus, reply, replySkipped };
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
    [runId,workspaceId,rule.id,rule.name,wamId,JSON.stringify(actions),conversationId,rule.conversationStatus,JSON.stringify(rule.tags),channelId,rule.updatedAt]);
  if (!rows.length) return null;
  return { runId, ruleId: rule.id, ruleName: rule.name, reply };
}

/** Records what happened to a planned reply: sent, skipped with a reason, or failed. */
export async function recordReplyOutcome(workspaceId: string, runId: string, outcome: string): Promise<void> {
  await db().query(
    `UPDATE app_automation_runs SET applied_actions = applied_actions || jsonb_build_object('replyOutcome', $3::text)
     WHERE workspace_id = $1::uuid AND id = $2::uuid`,
    [workspaceId, runId, outcome]
  );
}

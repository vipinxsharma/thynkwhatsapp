import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { Contact, Conversation, Message, PhoneNumber, WABAAccount } from "@/types/strapi";

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

type ContactRow = {
  id: string;
  waId: string;
  phoneNumber: string;
  name: string;
  tags: string[];
  customAttributes: Record<string, unknown>;
  lastSeenAt: string | null;
};

type ConversationRow = ContactRow & {
  conversationId: string;
  status: Conversation["status"];
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  windowExpiresAt: string;
  lastMessageAt: string;
  unreadCount: number;
  lastMessage: Message | null;
};

function contactFromRow(row: ContactRow): Contact {
  return {
    id: row.id,
    waId: row.waId,
    phoneNumber: row.phoneNumber,
    name: row.name,
    tags: row.tags || [],
    customAttributes: row.customAttributes || {},
    lastSeenAt: row.lastSeenAt || undefined,
  };
}

function phoneFromRow(row: ConversationRow): PhoneNumber {
  return {
    id: row.phoneNumberId,
    phoneNumberId: row.phoneNumberId,
    displayPhoneNumber: row.displayPhoneNumber || "",
    verifiedName: row.verifiedName || "",
    qualityRating: "UNKNOWN",
    codeVerificationStatus: "NOT_VERIFIED",
  };
}

function conversationFromRow(row: ConversationRow): Conversation {
  return {
    id: row.conversationId,
    status: row.status,
    windowExpiresAt: row.windowExpiresAt,
    lastMessageAt: row.lastMessageAt,
    unreadCount: row.unreadCount,
    contact: contactFromRow(row),
    phoneNumber: phoneFromRow(row),
    lastMessage: row.lastMessage || undefined,
  };
}

const conversationSelect = `
  SELECT c.id AS "conversationId", c.status, c.phone_number_id AS "phoneNumberId",
    c.window_expires_at AS "windowExpiresAt", c.last_message_at AS "lastMessageAt",
    c.unread_count AS "unreadCount", contact.id, contact.wa_id AS "waId",
    contact.phone_number AS "phoneNumber", contact.name, contact.tags,
    contact.custom_attributes AS "customAttributes", contact.last_seen_at AS "lastSeenAt",
    w.display_phone_number AS "displayPhoneNumber", w.verified_name AS "verifiedName",
    CASE WHEN recent.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', recent.id, 'wamId', recent.wam_id, 'direction', recent.direction,
      'type', recent.type, 'body', recent.body, 'rawPayload', recent.raw_payload,
      'status', recent.status, 'timestamp', recent.timestamp,
      'conversationId', recent.conversation_id
    ) END AS "lastMessage"
  FROM app_inbox_conversations c
  JOIN app_inbox_contacts contact ON contact.id = c.contact_id AND contact.workspace_id = c.workspace_id
  LEFT JOIN app_whatsapp_channels w ON w.workspace_id = c.workspace_id AND w.phone_number_id = c.phone_number_id
  LEFT JOIN LATERAL (
    SELECT * FROM app_inbox_messages m
    WHERE m.workspace_id = c.workspace_id AND m.conversation_id = c.id
    ORDER BY m.timestamp DESC LIMIT 1
  ) recent ON true`;

export async function listConversations(workspaceId: string): Promise<Conversation[]> {
  const rows = await database().query(
    `${conversationSelect} WHERE c.workspace_id = $1::uuid ORDER BY c.last_message_at DESC LIMIT 200`,
    [workspaceId]
  );
  return (rows as ConversationRow[]).map(conversationFromRow);
}

export async function getConversation(workspaceId: string, conversationId: string): Promise<Conversation | null> {
  const rows = await database().query(
    `${conversationSelect} WHERE c.workspace_id = $1::uuid AND c.id = $2::uuid LIMIT 1`,
    [workspaceId, conversationId]
  );
  return rows[0] ? conversationFromRow(rows[0] as ConversationRow) : null;
}

export async function getMessages(workspaceId: string, conversationId: string): Promise<Message[]> {
  const rows = await database().query(
    `SELECT id, wam_id AS "wamId", direction, type, body, raw_payload AS "rawPayload",
      status, timestamp, conversation_id AS "conversationId"
     FROM app_inbox_messages WHERE workspace_id = $1::uuid AND conversation_id = $2::uuid
     ORDER BY timestamp ASC LIMIT 500`,
    [workspaceId, conversationId]
  );
  return rows as Message[];
}

export async function ensureContactConversation(input: {
  workspaceId: string;
  name: string;
  phoneNumber: string;
  tags?: string[];
  customAttributes?: Record<string, unknown>;
  phoneNumberId?: string;
  inbound?: boolean;
}): Promise<{ contact: Contact; conversation: Conversation; created: boolean }> {
  const waId = input.phoneNumber.replace(/\D/g, "");
  if (waId.length < 8 || waId.length > 15) throw new Error("Invalid international phone number");
  const contactRows = await database().query(
    `WITH inserted AS (
       INSERT INTO app_inbox_contacts
         (id, workspace_id, wa_id, phone_number, name, tags, custom_attributes, last_seen_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7::jsonb,
         CASE WHEN $8::boolean THEN now() ELSE NULL END)
       ON CONFLICT (workspace_id, wa_id) DO NOTHING
       RETURNING id, true AS created
     )
     SELECT id, created FROM inserted
     UNION ALL
     SELECT id, false AS created FROM app_inbox_contacts
     WHERE workspace_id = $2::uuid AND wa_id = $3 AND NOT EXISTS (SELECT 1 FROM inserted)
     LIMIT 1`,
    [randomUUID(), input.workspaceId, waId, input.phoneNumber, input.name,
      JSON.stringify(input.tags || []), JSON.stringify(input.customAttributes || {}), Boolean(input.inbound)]
  );
  const contactRow = contactRows[0] as { id: string; created: boolean } | undefined;
  if (!contactRow) throw new Error("Unable to create or find contact");
  const defaultRows = input.phoneNumberId ? [] : await database().query(
    `SELECT phone_number_id AS "phoneNumberId" FROM app_workspace_channel_defaults
     WHERE workspace_id = $1::uuid LIMIT 1`,
    [input.workspaceId]
  );
  const phoneNumberId = input.phoneNumberId || (defaultRows[0] as { phoneNumberId?: string } | undefined)?.phoneNumberId || "";
  const conversationRows = await database().query(
    `INSERT INTO app_inbox_conversations (id, workspace_id, contact_id, phone_number_id)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4)
     ON CONFLICT (workspace_id, contact_id, phone_number_id) DO UPDATE SET
       updated_at = app_inbox_conversations.updated_at
     RETURNING id`,
    [randomUUID(), input.workspaceId, contactRow.id, phoneNumberId]
  );
  const conversationId = (conversationRows[0] as { id: string }).id;
  const conversation = await getConversation(input.workspaceId, conversationId);
  if (!conversation) throw new Error("Conversation was not persisted");
  return { contact: conversation.contact, conversation, created: contactRow.created };
}

export async function recordMessage(
  workspaceId: string,
  conversationId: string,
  message: Omit<Message, "id">
): Promise<Message> {
  const rows = await database().query(
    `WITH inserted AS (
       INSERT INTO app_inbox_messages
         (id, workspace_id, conversation_id, wam_id, direction, type, body, raw_payload, status, timestamp)
       SELECT $1::uuid, $2::uuid, c.id, $4, $5, $6, $7, $8::jsonb, $9, $10::timestamptz
       FROM app_inbox_conversations c WHERE c.workspace_id = $2::uuid AND c.id = $3::uuid
       ON CONFLICT (workspace_id, wam_id) DO NOTHING
       RETURNING *
     ), advanced AS (
       UPDATE app_inbox_conversations c SET
         last_message_at = greatest(c.last_message_at, $10::timestamptz),
         window_expires_at = CASE WHEN $5 = 'inbound'
           THEN greatest(c.window_expires_at, $10::timestamptz + interval '24 hours')
           ELSE c.window_expires_at END,
         unread_count = c.unread_count + CASE WHEN $5 = 'inbound' THEN 1 ELSE 0 END,
         updated_at = now()
       WHERE c.workspace_id = $2::uuid AND c.id = $3::uuid AND EXISTS (SELECT 1 FROM inserted)
       RETURNING c.id
     )
     SELECT id, wam_id AS "wamId", direction, type, body, raw_payload AS "rawPayload",
       status, timestamp, conversation_id AS "conversationId" FROM inserted
     UNION ALL
     SELECT id, wam_id AS "wamId", direction, type, body, raw_payload AS "rawPayload",
       status, timestamp, conversation_id AS "conversationId"
     FROM app_inbox_messages WHERE workspace_id = $2::uuid AND conversation_id = $3::uuid
       AND wam_id = $4 AND NOT EXISTS (SELECT 1 FROM inserted)
     LIMIT 1`,
    [randomUUID(), workspaceId, conversationId, message.wamId, message.direction,
      message.type, message.body, JSON.stringify(message.rawPayload || {}), message.status, message.timestamp]
  );
  if (!rows[0]) throw new Error("Message was not persisted in the selected workspace conversation");
  return rows[0] as Message;
}

export async function updateMessageStatus(workspaceId: string, wamId: string, status: Message["status"]): Promise<void> {
  await database().query(
    `UPDATE app_inbox_messages SET status = $3
     WHERE workspace_id = $1::uuid AND wam_id = $2
       AND (CASE status WHEN 'received' THEN 0 WHEN 'queued' THEN 1 WHEN 'sent' THEN 2
         WHEN 'delivered' THEN 3 WHEN 'read' THEN 4 ELSE 0 END)
         < (CASE $3 WHEN 'received' THEN 0 WHEN 'queued' THEN 1 WHEN 'sent' THEN 2
           WHEN 'delivered' THEN 3 WHEN 'read' THEN 4 ELSE 5 END)`,
    [workspaceId, wamId, status]
  );
}

export async function updateContact(
  workspaceId: string,
  contactId: string,
  updates: Partial<Contact>
): Promise<Contact | null> {
  const rows = await database().query(
    `UPDATE app_inbox_contacts SET
       name = coalesce($3, name),
       phone_number = coalesce($4, phone_number),
       wa_id = coalesce($5, wa_id),
       tags = coalesce($6::jsonb, tags),
       custom_attributes = custom_attributes || coalesce($7::jsonb, '{}'::jsonb),
       updated_at = now()
     WHERE workspace_id = $1::uuid AND id = $2::uuid
     RETURNING id, wa_id AS "waId", phone_number AS "phoneNumber", name, tags,
       custom_attributes AS "customAttributes", last_seen_at AS "lastSeenAt"`,
    [workspaceId, contactId, updates.name || null, updates.phoneNumber || null, updates.waId || null,
      updates.tags ? JSON.stringify(updates.tags) : null,
      updates.customAttributes ? JSON.stringify(updates.customAttributes) : null]
  );
  return rows[0] ? contactFromRow(rows[0] as ContactRow) : null;
}

export async function deleteContact(workspaceId: string, contactId: string): Promise<boolean> {
  const rows = await database().query(
    `DELETE FROM app_inbox_contacts WHERE workspace_id = $1::uuid AND id = $2::uuid RETURNING id`,
    [workspaceId, contactId]
  );
  return rows.length > 0;
}

export async function getWABA(workspaceId: string): Promise<WABAAccount> {
  const rows = await database().query(
    `SELECT a.waba_id AS "wabaId", a.webhook_subscribed AS "webhookSubscribed",
      c.verified_name AS "verifiedName"
     FROM app_workspace_channel_defaults d
     JOIN app_whatsapp_channels c ON c.workspace_id = d.workspace_id
       AND c.phone_number_id = d.phone_number_id
     JOIN app_waba_connections a ON a.workspace_id = c.workspace_id AND a.waba_id = c.waba_id
     WHERE d.workspace_id = $1::uuid AND c.enabled AND a.status = 'connected' LIMIT 1`,
    [workspaceId]
  );
  const row = rows[0] as {
    wabaId: string; verifiedName: string | null; webhookSubscribed: boolean;
  } | undefined;
  const numbers = await database().query(
    `SELECT c.phone_number_id AS "phoneNumberId", c.display_phone_number AS "displayPhoneNumber",
      c.verified_name AS "verifiedName", c.quality_rating AS "qualityRating",
      c.code_verification_status AS "codeVerificationStatus"
     FROM app_whatsapp_channels c
     JOIN app_waba_connections a ON a.workspace_id = c.workspace_id AND a.waba_id = c.waba_id
     WHERE c.workspace_id = $1::uuid AND c.enabled AND a.status = 'connected'
     ORDER BY c.connected_at, c.phone_number_id`,
    [workspaceId]
  ) as Array<{
    phoneNumberId: string; displayPhoneNumber: string | null; verifiedName: string | null;
    qualityRating: string | null; codeVerificationStatus: string | null;
  }>;
  return {
    id: row?.wabaId || "",
    wabaId: row?.wabaId || "",
    name: row?.verifiedName || "Not connected",
    currency: "",
    timezoneId: "",
    // A connected binding is not evidence that Meta approved the WABA.
    accountReviewStatus: "PENDING",
    webhookSubscribed: row?.webhookSubscribed || false,
    phoneNumbers: numbers.map((number) => ({
      id: number.phoneNumberId,
      phoneNumberId: number.phoneNumberId,
      displayPhoneNumber: number.displayPhoneNumber || "",
      verifiedName: number.verifiedName || "",
      qualityRating: (["GREEN", "YELLOW", "RED"].includes(number.qualityRating || "")
        ? number.qualityRating : "UNKNOWN") as PhoneNumber["qualityRating"],
      codeVerificationStatus: (number.codeVerificationStatus === "VERIFIED" || number.codeVerificationStatus === "NOT_VERIFIED"
        ? number.codeVerificationStatus : "UNKNOWN") as PhoneNumber["codeVerificationStatus"],
    })),
  };
}

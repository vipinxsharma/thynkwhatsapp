import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { ConsentStatus, FieldDefinition, FieldType } from "./validation";

// Contact CRM persistence. Lives beside the inbox store so the shared inbox module stays untouched.
// Contacts themselves are still written through lib/inbox/store.ts.

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

export type ContactGroup = {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
};

export type ContactListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  tag?: string;
  groupId?: string;
  consent?: "all" | ConsentStatus;
};

export type ContactListRow = {
  id: string;
  waId: string;
  phoneNumber: string;
  name: string;
  tags: string[];
  customAttributes: Record<string, unknown>;
  lastSeenAt: string | null;
  consentStatus: ConsentStatus;
  consentUpdatedAt: string | null;
  groupIds: string[];
  conversationId: string | null;
  windowExpiresAt: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

/** Postgres unique violation (23505), reported by the Neon driver as code or message. */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  const message = String((error as { message?: unknown }).message || "");
  return code === "23505" || /duplicate key value/i.test(message);
}

const MAX_GROUPS = 200;
const MAX_FIELD_DEFINITIONS = 100;

export async function listContactGroups(workspaceId: string): Promise<ContactGroup[]> {
  const rows = await database().query(
    `SELECT g.id, g.name, g.created_at AS "createdAt", COUNT(m.contact_id)::int AS "memberCount"
     FROM app_contact_groups g
     LEFT JOIN app_contact_group_members m ON m.workspace_id = g.workspace_id AND m.group_id = g.id
     WHERE g.workspace_id = $1::uuid
     GROUP BY g.id, g.name, g.created_at
     ORDER BY lower(g.name) ASC
     LIMIT ${MAX_GROUPS}`,
    [workspaceId],
  );
  return rows as ContactGroup[];
}

export async function createContactGroup(workspaceId: string, userId: string, name: string): Promise<ContactGroup | undefined> {
  const rows = await database().query(
    `INSERT INTO app_contact_groups (id, workspace_id, name, created_by_auth_user_id)
     VALUES ($1::uuid, $2::uuid, $3::text, $4::text)
     RETURNING id, name, created_at AS "createdAt", 0 AS "memberCount"`,
    [randomUUID(), workspaceId, name, userId],
  );
  return rows[0] as ContactGroup | undefined;
}

export async function renameContactGroup(workspaceId: string, groupId: string, name: string): Promise<ContactGroup | undefined> {
  const rows = await database().query(
    `UPDATE app_contact_groups SET name = $3::text, updated_at = now()
     WHERE workspace_id = $1::uuid AND id = $2::uuid
     RETURNING id, name, created_at AS "createdAt",
       (SELECT COUNT(*)::int FROM app_contact_group_members m
        WHERE m.workspace_id = app_contact_groups.workspace_id AND m.group_id = app_contact_groups.id) AS "memberCount"`,
    [workspaceId, groupId, name],
  );
  return rows[0] as ContactGroup | undefined;
}

/** Deleting a group removes its memberships only; contacts are untouched. */
export async function deleteContactGroup(workspaceId: string, groupId: string): Promise<boolean> {
  const rows = await database().query(
    `DELETE FROM app_contact_groups WHERE workspace_id = $1::uuid AND id = $2::uuid RETURNING id`,
    [workspaceId, groupId],
  );
  return rows.length > 0;
}

/** Adds contacts to a group. Returns how many memberships were created (existing ones are kept). */
export async function addContactsToGroup(workspaceId: string, groupId: string, contactIds: string[]): Promise<number> {
  if (contactIds.length === 0) return 0;
  const rows = await database().query(
    `WITH inserted AS (
       INSERT INTO app_contact_group_members (workspace_id, group_id, contact_id)
       SELECT g.workspace_id, g.id, c.id
       FROM app_contact_groups g
       JOIN app_inbox_contacts c ON c.workspace_id = g.workspace_id
       WHERE g.workspace_id = $1::uuid AND g.id = $2::uuid
         AND c.id IN (SELECT value::uuid FROM jsonb_array_elements_text($3::jsonb) AS value)
       ON CONFLICT DO NOTHING
       RETURNING contact_id
     )
     SELECT COUNT(*)::int AS added FROM inserted`,
    [workspaceId, groupId, JSON.stringify(contactIds)],
  );
  return Number((rows[0] as { added?: number } | undefined)?.added || 0);
}

export async function removeContactFromGroup(workspaceId: string, groupId: string, contactId: string): Promise<boolean> {
  const rows = await database().query(
    `DELETE FROM app_contact_group_members
     WHERE workspace_id = $1::uuid AND group_id = $2::uuid AND contact_id = $3::uuid
     RETURNING contact_id`,
    [workspaceId, groupId, contactId],
  );
  return rows.length > 0;
}

/** Makes a contact's group memberships exactly `groupIds` (within this workspace). */
export async function setContactGroups(workspaceId: string, contactId: string, groupIds: string[]): Promise<void> {
  await database().query(
    `WITH wanted AS (
       SELECT value::uuid AS group_id FROM jsonb_array_elements_text($3::jsonb) AS value
     ), removed AS (
       DELETE FROM app_contact_group_members m
       WHERE m.workspace_id = $1::uuid AND m.contact_id = $2::uuid
         AND m.group_id NOT IN (SELECT group_id FROM wanted)
       RETURNING 1
     ), added AS (
       INSERT INTO app_contact_group_members (workspace_id, group_id, contact_id)
       SELECT g.workspace_id, g.id, c.id
       FROM app_contact_groups g
       JOIN app_inbox_contacts c ON c.workspace_id = g.workspace_id AND c.id = $2::uuid
       WHERE g.workspace_id = $1::uuid AND g.id IN (SELECT group_id FROM wanted)
       ON CONFLICT DO NOTHING
       RETURNING 1
     )
     SELECT (SELECT COUNT(*) FROM removed)::int AS removed, (SELECT COUNT(*) FROM added)::int AS added`,
    [workspaceId, contactId, JSON.stringify(groupIds)],
  );
}

/** Finds a group by case-insensitive name, creating it when missing. Used by CSV import. */
export async function findOrCreateContactGroupByName(
  workspaceId: string,
  userId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const rows = await database().query(
    `WITH inserted AS (
       INSERT INTO app_contact_groups (id, workspace_id, name, created_by_auth_user_id)
       VALUES ($1::uuid, $2::uuid, $3::text, $4::text)
       ON CONFLICT (workspace_id, lower(name)) DO NOTHING
       RETURNING id, name
     )
     SELECT id, name FROM inserted
     UNION ALL
     SELECT id, name FROM app_contact_groups
     WHERE workspace_id = $2::uuid AND lower(name) = lower($3::text)
       AND NOT EXISTS (SELECT 1 FROM inserted)
     LIMIT 1`,
    [randomUUID(), workspaceId, name, userId],
  );
  const row = rows[0] as { id: string; name: string } | undefined;
  if (!row) throw new Error("Unable to create or find contact group");
  return row;
}

export async function listContactFieldDefinitions(workspaceId: string): Promise<FieldDefinition[]> {
  const rows = await database().query(
    `SELECT id, field_key AS key, label, field_type AS type, choices
     FROM app_contact_field_definitions
     WHERE workspace_id = $1::uuid
     ORDER BY lower(label) ASC
     LIMIT ${MAX_FIELD_DEFINITIONS}`,
    [workspaceId],
  );
  return rows as FieldDefinition[];
}

/** Returns undefined when the workspace already has the maximum number of field definitions. */
export async function createContactFieldDefinition(
  workspaceId: string,
  input: { key: string; label: string; type: FieldType; choices: string[] },
): Promise<FieldDefinition | undefined> {
  const rows = await database().query(
    `INSERT INTO app_contact_field_definitions (id, workspace_id, field_key, label, field_type, choices)
     SELECT $1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::jsonb
     WHERE (SELECT COUNT(*) FROM app_contact_field_definitions WHERE workspace_id = $2::uuid) < ${MAX_FIELD_DEFINITIONS}
     RETURNING id, field_key AS key, label, field_type AS type, choices`,
    [randomUUID(), workspaceId, input.key, input.label, input.type, JSON.stringify(input.choices)],
  );
  return rows[0] as FieldDefinition | undefined;
}

/** The key and type are fixed once created so stored values stay meaningful. */
export async function updateContactFieldDefinition(
  workspaceId: string,
  definitionId: string,
  input: { label: string; choices: string[] | null },
): Promise<FieldDefinition | undefined> {
  const rows = await database().query(
    `UPDATE app_contact_field_definitions SET
       label = $3::text,
       choices = COALESCE($4::jsonb, choices),
       updated_at = now()
     WHERE workspace_id = $1::uuid AND id = $2::uuid
     RETURNING id, field_key AS key, label, field_type AS type, choices`,
    [workspaceId, definitionId, input.label, input.choices ? JSON.stringify(input.choices) : null],
  );
  return rows[0] as FieldDefinition | undefined;
}

/** Deleting a definition keeps existing values on contacts; they simply stop being typed. */
export async function deleteContactFieldDefinition(workspaceId: string, definitionId: string): Promise<boolean> {
  const rows = await database().query(
    `DELETE FROM app_contact_field_definitions WHERE workspace_id = $1::uuid AND id = $2::uuid RETURNING id`,
    [workspaceId, definitionId],
  );
  return rows.length > 0;
}

/** Sets opt-in state for many contacts at once and writes one audit row per contact. */
export async function setContactConsent(
  workspaceId: string,
  userId: string,
  contactIds: string[],
  status: ConsentStatus,
): Promise<number> {
  const rows = await database().query(
    `WITH updated AS (
       UPDATE app_inbox_contacts SET consent_status = $3::text, consent_updated_at = now(), updated_at = now()
       WHERE workspace_id = $1::uuid
         AND id IN (SELECT value::uuid FROM jsonb_array_elements_text($2::jsonb) AS value)
       RETURNING id
     ), audit AS (
       INSERT INTO app_audit_logs (id, workspace_id, auth_user_id, action, resource_type, resource_id, metadata)
       SELECT gen_random_uuid(), $1::uuid, $4::text, 'contact.consent_updated', 'contact', id::text,
         jsonb_build_object('status', $3::text)
       FROM updated
     )
     SELECT COUNT(*)::int AS updated FROM updated`,
    [workspaceId, JSON.stringify(contactIds), status, userId],
  );
  return Number((rows[0] as { updated?: number } | undefined)?.updated || 0);
}

export async function listContactTags(workspaceId: string): Promise<string[]> {
  const rows = await database().query(
    `SELECT DISTINCT tag FROM app_inbox_contacts c, jsonb_array_elements_text(c.tags) AS tag
     WHERE c.workspace_id = $1::uuid
     ORDER BY tag ASC
     LIMIT 200`,
    [workspaceId],
  );
  return (rows as Array<{ tag: string }>).map((row) => row.tag);
}

/**
 * Server-side page of contacts with filters. One row per contact; the most recent conversation
 * (if any) supplies the 24-hour window fields the list shows.
 */
export async function listContactsPage(
  workspaceId: string,
  query: ContactListQuery,
): Promise<{ contacts: ContactListRow[]; total: number }> {
  const params: unknown[] = [workspaceId];
  const where = ["c.workspace_id = $1::uuid"];
  const bind = (value: unknown, cast: string) => {
    params.push(value);
    return `$${params.length}${cast}`;
  };

  if (query.search) {
    const pattern = bind(`%${query.search.replace(/[\\%_]/g, "\\$&")}%`, "::text");
    where.push(`(c.name ILIKE ${pattern}
      OR c.phone_number ILIKE ${pattern}
      OR c.wa_id LIKE ${pattern}
      OR coalesce(c.custom_attributes->>'company', '') ILIKE ${pattern})`);
  }
  if (query.tag) where.push(`c.tags @> ${bind(JSON.stringify([query.tag]), "::jsonb")}`);
  if (query.groupId) {
    where.push(`EXISTS (SELECT 1 FROM app_contact_group_members m
      WHERE m.workspace_id = c.workspace_id AND m.contact_id = c.id AND m.group_id = ${bind(query.groupId, "::uuid")})`);
  }
  if (query.consent && query.consent !== "all") where.push(`c.consent_status = ${bind(query.consent, "::text")}`);

  const whereSql = where.join(" AND ");
  const countRows = await database().query(
    `SELECT COUNT(*)::int AS total FROM app_inbox_contacts c WHERE ${whereSql}`,
    params,
  );
  const total = Number((countRows[0] as { total?: number } | undefined)?.total || 0);

  const offset = (query.page - 1) * query.pageSize;
  const limitParam = bind(query.pageSize, "::int");
  const offsetParam = bind(offset, "::int");
  const rows = await database().query(
    `SELECT c.id, c.wa_id AS "waId", c.phone_number AS "phoneNumber", c.name, c.tags,
       c.custom_attributes AS "customAttributes", c.last_seen_at AS "lastSeenAt",
       c.consent_status AS "consentStatus", c.consent_updated_at AS "consentUpdatedAt",
       COALESCE((SELECT jsonb_agg(m.group_id::text ORDER BY m.group_id)
         FROM app_contact_group_members m
         WHERE m.workspace_id = c.workspace_id AND m.contact_id = c.id), '[]'::jsonb) AS "groupIds",
       conv.conversation_id AS "conversationId", conv.window_expires_at AS "windowExpiresAt",
       conv.last_message_at AS "lastMessageAt", conv.unread_count AS "unreadCount"
     FROM app_inbox_contacts c
     LEFT JOIN LATERAL (
       SELECT cv.id AS conversation_id, cv.window_expires_at, cv.last_message_at, cv.unread_count
       FROM app_inbox_conversations cv
       WHERE cv.workspace_id = c.workspace_id AND cv.contact_id = c.id
       ORDER BY cv.last_message_at DESC
       LIMIT 1
     ) conv ON true
     WHERE ${whereSql}
     ORDER BY c.name ASC, c.id ASC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params,
  );
  return { contacts: rows as ContactListRow[], total };
}

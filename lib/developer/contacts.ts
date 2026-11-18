import { developerDatabase } from "@/lib/developer/db";

export interface ApiContact {
  id: string;
  waId: string;
  phoneNumber: string;
  name: string;
  tags: string[];
  customAttributes: Record<string, unknown>;
  lastSeenAt: string | null;
  createdAt: string;
}

/** Keyset page of a workspace's contacts, oldest first. `after` comes from the previous page's cursor. */
export async function listContactsPage(input: {
  workspaceId: string;
  limit: number;
  after: { createdAt: string; id: string } | null;
}): Promise<ApiContact[]> {
  const rows = await developerDatabase().query(
    `SELECT id, wa_id AS "waId", phone_number AS "phoneNumber", name, tags,
       custom_attributes AS "customAttributes", last_seen_at AS "lastSeenAt",
       to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt"
     FROM app_inbox_contacts
     WHERE workspace_id = $1::uuid
       AND ($2::timestamptz IS NULL OR (created_at, id) > ($2::timestamptz, $3::uuid))
     ORDER BY created_at ASC, id ASC
     LIMIT $4`,
    [
      input.workspaceId,
      input.after?.createdAt ?? null,
      input.after?.id ?? "00000000-0000-0000-0000-000000000000",
      input.limit,
    ],
  );
  return rows as ApiContact[];
}

import { neon } from "@neondatabase/serverless";

export type PartnerAccessStatus = "none" | "requested" | "approved" | "rejected";

export interface PartnerAccess {
  status: PartnerAccessStatus;
  requestedAt: string | null;
  decidedAt: string | null;
}

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

const iso = (value: unknown): string | null => (value ? new Date(value as string).toISOString() : null);

export async function getPartnerAccess(workspaceId: string): Promise<PartnerAccess> {
  const rows = await database().query(
    `SELECT status, requested_at AS "requestedAt", decided_at AS "decidedAt"
     FROM app_workspace_partner_access WHERE workspace_id = $1::uuid`,
    [workspaceId]
  );
  const row = rows[0] as { status: PartnerAccessStatus; requestedAt: unknown; decidedAt: unknown } | undefined;
  return row
    ? { status: row.status, requestedAt: iso(row.requestedAt), decidedAt: iso(row.decidedAt) }
    : { status: "none", requestedAt: null, decidedAt: null };
}

/** True only after a platform superadmin has approved or assigned access. Failures read as not approved. */
export async function partnerAccessApproved(workspaceId: string): Promise<boolean> {
  try {
    return (await getPartnerAccess(workspaceId)).status === "approved";
  } catch {
    return false;
  }
}

/** A workspace owner or admin asks for partner features. Re-requesting while already approved changes nothing. */
export async function requestPartnerAccess(workspaceId: string, authUserId: string): Promise<PartnerAccess> {
  await database().query(
    `INSERT INTO app_workspace_partner_access (workspace_id, status, requested_by_auth_user_id, requested_at, updated_at)
     VALUES ($1::uuid, 'requested', $2, now(), now())
     ON CONFLICT (workspace_id) DO UPDATE SET
       status = 'requested', requested_by_auth_user_id = EXCLUDED.requested_by_auth_user_id,
       requested_at = now(), updated_at = now()
     WHERE app_workspace_partner_access.status <> 'approved'`,
    [workspaceId, authUserId]
  );
  return getPartnerAccess(workspaceId);
}

/** Platform superadmin decision: approve a request, reject it, or assign access directly. */
export async function decidePartnerAccess(input: {
  workspaceId: string;
  decision: "approved" | "rejected" | "assigned";
  superadminAuthUserId: string;
}): Promise<PartnerAccess> {
  const status = input.decision === "rejected" ? "rejected" : "approved";
  await database().query(
    `INSERT INTO app_workspace_partner_access
       (workspace_id, status, decided_by_auth_user_id, decided_at, decision, updated_at)
     VALUES ($1::uuid, $2, $3, now(), $4, now())
     ON CONFLICT (workspace_id) DO UPDATE SET
       status = EXCLUDED.status, decided_by_auth_user_id = EXCLUDED.decided_by_auth_user_id,
       decided_at = now(), decision = EXCLUDED.decision, updated_at = now()`,
    [input.workspaceId, status, input.superadminAuthUserId, input.decision]
  );
  return getPartnerAccess(input.workspaceId);
}

/** Requests waiting for a decision, oldest first, for the platform admin page. */
export async function listPendingPartnerRequests(): Promise<Array<{ workspaceId: string; workspaceName: string; requestedAt: string | null }>> {
  const rows = await database().query(
    `SELECT a.workspace_id AS "workspaceId", w.name AS "workspaceName", a.requested_at AS "requestedAt"
     FROM app_workspace_partner_access a JOIN app_workspaces w ON w.id = a.workspace_id
     WHERE a.status = 'requested' ORDER BY a.requested_at ASC LIMIT 200`,
    []
  );
  return (rows as Array<{ workspaceId: string; workspaceName: string; requestedAt: unknown }>).map((row) => ({
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName,
    requestedAt: iso(row.requestedAt),
  }));
}

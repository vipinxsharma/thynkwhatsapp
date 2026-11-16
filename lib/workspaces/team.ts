import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { AppRole } from "@/lib/auth/token";
import { createWorkspaceSlug, type WorkspaceMembership } from "@/lib/workspaces/store";

export interface TeamMember {
  id: string;
  authUserId: string;
  email: string;
  displayName: string;
  role: AppRole;
  status: "invited" | "active" | "suspended";
  createdAt: string;
}

export interface WorkspaceInvitation {
  id: string;
  invitedEmail: string;
  role: "admin" | "agent" | "viewer";
  expiresAt: string;
  createdAt: string;
}

export type InviteRole = WorkspaceInvitation["role"];

function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

export function isInviteRole(value: unknown): value is InviteRole {
  return ["admin", "agent", "viewer"].includes(String(value));
}

export function hashInvitationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function listWorkspaceTeam(workspaceId: string): Promise<{
  members: TeamMember[];
  invitations: WorkspaceInvitation[];
}> {
  const database = sql();
  const [members, invitations] = await Promise.all([
    database.query(
      `SELECT id, auth_user_id AS "authUserId", email, display_name AS "displayName",
        role, status, created_at AS "createdAt"
       FROM app_workspace_members WHERE workspace_id = $1::uuid ORDER BY created_at ASC`,
      [workspaceId]
    ),
    database.query(
      `SELECT id, invited_email AS "invitedEmail", role, expires_at AS "expiresAt", created_at AS "createdAt"
       FROM app_workspace_invitations
       WHERE workspace_id = $1::uuid AND accepted_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC`,
      [workspaceId]
    ),
  ]);
  return { members: members as TeamMember[], invitations: invitations as WorkspaceInvitation[] };
}

export async function createWorkspaceInvitation(input: {
  workspaceId: string;
  invitedEmail: string;
  role: InviteRole;
  invitedByAuthUserId: string;
}): Promise<{ invitation: WorkspaceInvitation; token: string }> {
  const database = sql();
  const existingMembers = await database.query(
    `SELECT 1 FROM app_workspace_members
     WHERE workspace_id = $1::uuid AND lower(email) = lower($2) AND status = 'active' LIMIT 1`,
    [input.workspaceId, input.invitedEmail]
  );
  if (existingMembers.length > 0) throw new Error("MEMBER_ALREADY_EXISTS");
  const token = crypto.randomBytes(32).toString("base64url");
  const invitationId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const rows = await database.query(
    `WITH upserted AS (
       INSERT INTO app_workspace_invitations
         (id, workspace_id, invited_email, role, token_hash, invited_by_auth_user_id, expires_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, now() + interval '72 hours')
       ON CONFLICT (workspace_id, invited_email) WHERE accepted_at IS NULL
       DO UPDATE SET role = EXCLUDED.role, token_hash = EXCLUDED.token_hash,
         invited_by_auth_user_id = EXCLUDED.invited_by_auth_user_id,
         expires_at = EXCLUDED.expires_at, created_at = now()
       RETURNING id, invited_email, role, expires_at, created_at
     ), audited AS (
       INSERT INTO app_audit_logs (id, workspace_id, auth_user_id, action, resource_type, resource_id, metadata)
       SELECT $7::uuid, $2::uuid, $6, 'workspace.invitation.created', 'workspace_invitation', id::text,
         jsonb_build_object('invitedEmail', invited_email, 'role', role)
       FROM upserted
     )
     SELECT id, invited_email AS "invitedEmail", role, expires_at AS "expiresAt", created_at AS "createdAt"
     FROM upserted`,
    [invitationId, input.workspaceId, input.invitedEmail, input.role, hashInvitationToken(token), input.invitedByAuthUserId, auditId]
  );
  return { invitation: rows[0] as WorkspaceInvitation, token };
}

export async function acceptWorkspaceInvitation(input: {
  token: string;
  authUserId: string;
  email: string;
  emailVerified?: boolean;
}): Promise<WorkspaceMembership | null> {
  const memberId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const tokenHash = hashInvitationToken(input.token);
  const kindRows = await sql().query(
    `SELECT kind FROM app_workspace_invitations
     WHERE token_hash = $1 AND lower(invited_email) = lower($2)
       AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
     LIMIT 1`,
    [tokenHash, input.email]
  );
  if (kindRows.length === 0) return null;
  if (kindRows[0].kind === "tenant_owner") {
    if (input.emailVerified !== true) throw new Error("EMAIL_NOT_VERIFIED");
    return acceptTenantOwnerInvitation({ ...input, tokenHash });
  }
  const rows = await sql().query(
    `WITH selected AS (
       SELECT i.id AS invitation_id
       FROM app_workspace_invitations i
       WHERE i.token_hash = $1 AND lower(i.invited_email) = lower($2)
         AND i.kind = 'member' AND i.revoked_at IS NULL
         AND i.accepted_at IS NULL AND i.expires_at > now()
       LIMIT 1
     ), accepted AS (
       UPDATE app_workspace_invitations SET accepted_at = now(), accepted_by_auth_user_id = $3
       WHERE id IN (SELECT invitation_id FROM selected) AND accepted_at IS NULL
       RETURNING id AS invitation_id, workspace_id, role
     ), invitation_context AS (
       SELECT accepted.*, w.name, w.slug
       FROM accepted JOIN app_workspaces w ON w.id = accepted.workspace_id
     ), member AS (
       INSERT INTO app_workspace_members
         (id, workspace_id, auth_user_id, email, display_name, role, status)
       SELECT $4::uuid, workspace_id, $3, lower($2), split_part($2, '@', 1), role, 'active'
       FROM invitation_context
       ON CONFLICT (workspace_id, auth_user_id)
       DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role, status = 'active', updated_at = now()
     ), audited AS (
       INSERT INTO app_audit_logs (id, workspace_id, auth_user_id, action, resource_type, resource_id)
       SELECT $5::uuid, workspace_id, $3, 'workspace.invitation.accepted', 'workspace_invitation', invitation_id::text
       FROM invitation_context
     )
     SELECT workspace_id AS "workspaceId", name AS "workspaceName", slug AS "workspaceSlug", role
     FROM invitation_context`,
    [tokenHash, input.email, input.authUserId, memberId, auditId]
  );
  return (rows[0] as WorkspaceMembership | undefined) || null;
}

async function acceptTenantOwnerInvitation(input: {
  tokenHash: string;
  authUserId: string;
  email: string;
}): Promise<WorkspaceMembership | null> {
  const workspaceId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const [invite] = await sql().query(
    `SELECT id, workspace_name FROM app_workspace_invitations
     WHERE token_hash = $1 AND lower(invited_email) = lower($2) AND kind = 'tenant_owner'
       AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
     LIMIT 1`,
    [input.tokenHash, input.email]
  );
  if (!invite) return null;
  const workspaceName = String(invite.workspace_name);
  const slug = createWorkspaceSlug(workspaceName, workspaceId);
  // One statement: create workspace, owner membership, mark accepted, audit.
  const rows = await sql().query(
    `WITH selected AS (
       SELECT i.id AS invitation_id, i.workspace_name
       FROM app_workspace_invitations i
       WHERE i.id = $1::uuid AND i.token_hash = $2 AND i.kind = 'tenant_owner'
         AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
     ), new_workspace AS (
       INSERT INTO app_workspaces (id, name, slug, created_by_auth_user_id)
       SELECT $3::uuid, workspace_name, $4, $5 FROM selected
       RETURNING id, name, slug
     ), accepted AS (
       UPDATE app_workspace_invitations
       SET accepted_at = now(), accepted_by_auth_user_id = $5,
           workspace_id = (SELECT id FROM new_workspace)
       WHERE id IN (SELECT invitation_id FROM selected) AND accepted_at IS NULL
       RETURNING id
     ), member AS (
       INSERT INTO app_workspace_members
         (id, workspace_id, auth_user_id, email, display_name, role, status)
       SELECT $6::uuid, id, $5, lower($7), split_part($7, '@', 1), 'owner', 'active'
       FROM new_workspace
     ), audited AS (
       INSERT INTO app_audit_logs (id, workspace_id, auth_user_id, action, resource_type, resource_id, metadata)
       SELECT $8::uuid, id, $5, 'workspace.created_by_invitation', 'workspace_invitation',
         (SELECT invitation_id::text FROM selected), jsonb_build_object('workspaceName', name)
       FROM new_workspace
     )
     SELECT id AS "workspaceId", name AS "workspaceName", slug AS "workspaceSlug", 'owner' AS role
     FROM new_workspace`,
    [invite.id, input.tokenHash, workspaceId, slug, input.authUserId, memberId, input.email, auditId]
  );
  return (rows[0] as WorkspaceMembership | undefined) || null;
}

export async function createTenantOwnerInvitation(input: {
  workspaceName: string;
  invitedEmail: string;
  auditWorkspaceId: string;
  createdByAuthUserId: string;
}): Promise<{ invitation: { id: string; invitedEmail: string; workspaceName: string; expiresAt: string }; token: string }> {
  const token = crypto.randomBytes(32).toString("base64url");
  const invitationId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const rows = await sql().query(
    `WITH inserted AS (
       INSERT INTO app_workspace_invitations
         (id, workspace_id, invited_email, role, token_hash, invited_by_auth_user_id,
          expires_at, kind, workspace_name)
       VALUES ($1::uuid, NULL, $2, 'admin', $3, $4, now() + interval '72 hours', 'tenant_owner', $5)
       RETURNING id, invited_email, workspace_name, expires_at
     ), audited AS (
       INSERT INTO app_audit_logs (id, workspace_id, auth_user_id, action, resource_type, resource_id, metadata)
       SELECT $6::uuid, $7::uuid, $4, 'platform.tenant_invitation.created', 'workspace_invitation', id::text,
         jsonb_build_object('invitedEmail', invited_email, 'workspaceName', workspace_name)
       FROM inserted
     )
     SELECT id, invited_email AS "invitedEmail", workspace_name AS "workspaceName", expires_at AS "expiresAt"
     FROM inserted`,
    [invitationId, input.invitedEmail, hashInvitationToken(token), input.createdByAuthUserId,
      input.workspaceName, auditId, input.auditWorkspaceId]
  );
  return { invitation: rows[0] as { id: string; invitedEmail: string; workspaceName: string; expiresAt: string }, token };
}

export async function listPendingTenantOwnerInvitations(): Promise<
  Array<{ id: string; invitedEmail: string; workspaceName: string; expiresAt: string; createdAt: string }>
> {
  return (await sql().query(
    `SELECT id, invited_email AS "invitedEmail", workspace_name AS "workspaceName",
       expires_at AS "expiresAt", created_at AS "createdAt"
     FROM app_workspace_invitations
     WHERE kind = 'tenant_owner' AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC LIMIT 200`
  )) as Array<{ id: string; invitedEmail: string; workspaceName: string; expiresAt: string; createdAt: string }>;
}

export async function revokeTenantOwnerInvitation(input: {
  invitationId: string;
  auditWorkspaceId: string;
  revokedByAuthUserId: string;
}): Promise<boolean> {
  const auditId = crypto.randomUUID();
  const rows = await sql().query(
    `WITH revoked AS (
       UPDATE app_workspace_invitations SET revoked_at = now()
       WHERE id = $1::uuid AND kind = 'tenant_owner' AND accepted_at IS NULL AND revoked_at IS NULL
       RETURNING id, invited_email
     ), audited AS (
       INSERT INTO app_audit_logs (id, workspace_id, auth_user_id, action, resource_type, resource_id, metadata)
       SELECT $2::uuid, $3::uuid, $4, 'platform.tenant_invitation.revoked', 'workspace_invitation', id::text,
         jsonb_build_object('invitedEmail', invited_email)
       FROM revoked
     )
     SELECT id FROM revoked`,
    [input.invitationId, auditId, input.auditWorkspaceId, input.revokedByAuthUserId]
  );
  return rows.length > 0;
}

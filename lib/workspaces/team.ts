import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { AppRole } from "@/lib/auth/token";
import type { WorkspaceMembership } from "@/lib/workspaces/store";

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
}): Promise<WorkspaceMembership | null> {
  const memberId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const rows = await sql().query(
    `WITH selected AS (
       SELECT i.id AS invitation_id
       FROM app_workspace_invitations i
       WHERE i.token_hash = $1 AND lower(i.invited_email) = lower($2)
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
    [hashInvitationToken(input.token), input.email, input.authUserId, memberId, auditId]
  );
  return (rows[0] as WorkspaceMembership | undefined) || null;
}

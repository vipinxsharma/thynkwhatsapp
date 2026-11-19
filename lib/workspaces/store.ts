import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { AppRole } from "@/lib/auth/token";

export interface WorkspaceMembership {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  role: AppRole;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export interface PlatformWorkspaceSummary {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  createdAt: string;
  activeMembers: number;
}

export function createWorkspaceSlug(name: string, userId: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "workspace";
  const suffix = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toLowerCase();
  return `${base}-${suffix || crypto.randomUUID().slice(0, 8)}`;
}

export async function ensureWorkspaceForUser(
  user: AuthenticatedUser
): Promise<WorkspaceMembership> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

  const sql = neon(databaseUrl);
  const workspaceId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const name = `${user.name.trim() || "My"} Workspace`;
  const slug = createWorkspaceSlug(name, user.id);

  const rows = await sql.query(
    `WITH existing AS (
       SELECT w.id, w.name, w.slug, m.role
       FROM app_workspace_members m
       JOIN app_workspaces w ON w.id = m.workspace_id
       WHERE m.auth_user_id = $1 AND m.status = 'active'
       ORDER BY m.created_at ASC
       LIMIT 1
     ), inserted_workspace AS (
       INSERT INTO app_workspaces (id, name, slug, created_by_auth_user_id)
       SELECT $2::uuid, $3, $4, $1
       WHERE NOT EXISTS (SELECT 1 FROM existing)
       RETURNING id, name, slug
     ), selected_workspace AS (
       SELECT id, name, slug, role FROM existing
       UNION ALL
       SELECT id, name, slug, 'owner'::text AS role FROM inserted_workspace
       LIMIT 1
     ), inserted_member AS (
       INSERT INTO app_workspace_members
         (id, workspace_id, auth_user_id, email, display_name, role, status)
       SELECT $5::uuid, id, $1, $6, $7, role, 'active'
       FROM selected_workspace
       ON CONFLICT (workspace_id, auth_user_id) DO NOTHING
     ), inserted_audit AS (
       INSERT INTO app_audit_logs
         (id, workspace_id, auth_user_id, action, resource_type, resource_id)
       SELECT $8::uuid, id, $1, 'workspace.created', 'workspace', id::text
       FROM inserted_workspace
     )
     SELECT id AS "workspaceId", name AS "workspaceName", slug AS "workspaceSlug", role
     FROM selected_workspace`,
    [user.id, workspaceId, name, slug, memberId, user.email, user.name, auditId]
  );

  const membership = rows[0] as WorkspaceMembership | undefined;
  if (!membership) throw new Error("Unable to create or load workspace membership");
  return membership;
}

export async function listWorkspaceMemberships(authUserId: string): Promise<WorkspaceMembership[]> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  return (await neon(databaseUrl).query(
    `SELECT w.id AS "workspaceId", w.name AS "workspaceName", w.slug AS "workspaceSlug", m.role
     FROM app_workspace_members m
     JOIN app_workspaces w ON w.id = m.workspace_id
     WHERE m.auth_user_id = $1 AND m.status = 'active'
     ORDER BY m.created_at ASC`,
    [authUserId]
  )) as WorkspaceMembership[];
}

export async function validateWorkspaceMembership(
  authUserId: string,
  workspaceId: string
): Promise<WorkspaceMembership | null> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  const rows = await neon(databaseUrl).query(
    `SELECT w.id AS "workspaceId", w.name AS "workspaceName", w.slug AS "workspaceSlug", m.role
     FROM app_workspace_members m
     JOIN app_workspaces w ON w.id = m.workspace_id
     WHERE m.auth_user_id = $1 AND m.workspace_id = $2::uuid AND m.status = 'active'
     LIMIT 1`,
    [authUserId, workspaceId]
  );
  return (rows[0] as WorkspaceMembership | undefined) || null;
}

export async function listPlatformWorkspaceSummaries(): Promise<PlatformWorkspaceSummary[]> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  return (await neon(databaseUrl).query(
    `SELECT w.id AS "workspaceId", w.name AS "workspaceName", w.slug AS "workspaceSlug",
            w.created_at AS "createdAt",
            COUNT(m.id) FILTER (WHERE m.status = 'active')::int AS "activeMembers"
     FROM app_workspaces w
     LEFT JOIN app_workspace_members m ON m.workspace_id = w.id
     GROUP BY w.id
     ORDER BY w.created_at DESC`
  )) as PlatformWorkspaceSummary[];
}

export interface PlatformTenantHealth {
  workspaceId: string;
  enabledChannels: number;
  conversations: number;
  outbound7d: number;
  failed7d: number;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
}

export type PlatformTenantHealthStatus = "No channel" | "Send failures" | "Active" | "Idle";

export function platformTenantHealthStatus(
  health: PlatformTenantHealth | undefined,
  now: Date = new Date()
): PlatformTenantHealthStatus {
  if (!health || health.enabledChannels === 0) return "No channel";
  if (health.failed7d > 0) return "Send failures";
  const recent = [health.lastInboundAt, health.lastOutboundAt]
    .filter((value): value is string => Boolean(value))
    .some((value) => now.getTime() - new Date(value).getTime() <= 7 * 24 * 60 * 60 * 1000);
  return recent ? "Active" : "Idle";
}

export async function listPlatformTenantHealth(): Promise<PlatformTenantHealth[]> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  return (await neon(databaseUrl).query(
    `SELECT w.id AS "workspaceId",
            (SELECT COUNT(*)::int FROM app_whatsapp_channels c
              WHERE c.workspace_id = w.id AND c.enabled) AS "enabledChannels",
            (SELECT COUNT(*)::int FROM app_inbox_conversations cv
              WHERE cv.workspace_id = w.id) AS "conversations",
            (SELECT COUNT(*)::int FROM app_inbox_messages m
              WHERE m.workspace_id = w.id AND m.direction = 'outbound'
                AND m.timestamp > now() - interval '7 days') AS "outbound7d",
            (SELECT COUNT(*)::int FROM app_inbox_messages m
              WHERE m.workspace_id = w.id AND m.direction = 'outbound'
                AND m.status = 'failed' AND m.timestamp > now() - interval '7 days') AS "failed7d",
            (SELECT MAX(m.timestamp) FROM app_inbox_messages m
              WHERE m.workspace_id = w.id AND m.direction = 'inbound') AS "lastInboundAt",
            (SELECT MAX(m.timestamp) FROM app_inbox_messages m
              WHERE m.workspace_id = w.id AND m.direction = 'outbound') AS "lastOutboundAt"
     FROM app_workspaces w`
  )) as PlatformTenantHealth[];
}

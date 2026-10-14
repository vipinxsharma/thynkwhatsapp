import { neon } from "@neondatabase/serverless";

export type UsageRange = "7d" | "30d" | "90d";

export type MessageUsage = {
  total: number;
  inbound: number;
  outbound: number;
  delivered: number;
  read: number;
  failed: number;
  lastMessageAt: string | null;
};

export function parseUsageRange(value: string | undefined): UsageRange {
  return value === "7d" || value === "90d" ? value : "30d";
}

export async function getMessageUsage(workspaceId: string, range: UsageRange): Promise<MessageUsage> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || process.env.INBOX_STORAGE !== "postgres") {
    throw new Error("Durable inbox storage is not configured");
  }

  const days = Number.parseInt(range, 10);
  const rows = await neon(databaseUrl).query(
    `SELECT count(*)::int AS total,
       count(*) FILTER (WHERE direction = 'inbound')::int AS inbound,
       count(*) FILTER (WHERE direction = 'outbound')::int AS outbound,
       count(*) FILTER (WHERE direction = 'outbound' AND status IN ('delivered', 'read'))::int AS delivered,
       count(*) FILTER (WHERE direction = 'outbound' AND status = 'read')::int AS read,
       count(*) FILTER (WHERE direction = 'outbound' AND status = 'failed')::int AS failed,
       max(timestamp) AS "lastMessageAt"
     FROM app_inbox_messages
     WHERE workspace_id = $1::uuid
       AND timestamp >= now() - make_interval(days => $2::int)`,
    [workspaceId, days]
  );

  const row = rows[0];
  return {
    total: Number(row.total),
    inbound: Number(row.inbound),
    outbound: Number(row.outbound),
    delivered: Number(row.delivered),
    read: Number(row.read),
    failed: Number(row.failed),
    lastMessageAt: row.lastMessageAt ? new Date(row.lastMessageAt).toISOString() : null,
  };
}

import { neon } from "@neondatabase/serverless";

/** True when the workspace has any subscription row. Errors count as subscribed, so no banner is shown by mistake. */
export async function workspaceHasSubscription(workspaceId: string): Promise<boolean> {
  try {
    if (!process.env.DATABASE_URL) return true;
    const rows = await neon(process.env.DATABASE_URL).query(
      `SELECT 1 FROM app_workspace_subscriptions WHERE workspace_id = $1::uuid LIMIT 1`,
      [workspaceId]
    );
    return rows.length > 0;
  } catch {
    return true;
  }
}

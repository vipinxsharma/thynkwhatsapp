import { neon } from "@neondatabase/serverless";
import { isValidPartnerCode } from "@/lib/partner-solutions/journeys";

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

/** Stores the partner code for a workspace once. Later codes never overwrite the first. */
export async function recordPartnerSignupCode(workspaceId: string, partnerCode: string): Promise<boolean> {
  if (!isValidPartnerCode(partnerCode)) return false;
  const rows = await database().query(
    `INSERT INTO app_partner_signup_codes (workspace_id, partner_code)
     VALUES ($1::uuid, $2)
     ON CONFLICT (workspace_id) DO NOTHING
     RETURNING workspace_id`,
    [workspaceId, partnerCode]
  );
  return rows.length > 0;
}

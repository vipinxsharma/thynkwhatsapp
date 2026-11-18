import { neon } from "@neondatabase/serverless";
import { isValidGstin, isValidStateCode, stateCodeFromGstin } from "@/lib/billing/gst";

export interface BuyerTaxInput {
  legalName: string;
  gstin: string | null;
  stateCode: string;
  address: string;
}

// Validates what the customer typed. GSTIN is optional (B2C), but when given its state must match stateCode.
export function parseBuyerTaxInput(body: Record<string, unknown>): { ok: true; value: BuyerTaxInput } | { ok: false; error: string } {
  const legalName = typeof body.legalName === "string" ? body.legalName.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const stateCode = typeof body.stateCode === "string" ? body.stateCode : "";
  const rawGstin = typeof body.gstin === "string" ? body.gstin.trim().toUpperCase() : "";
  if (legalName.length < 2 || legalName.length > 200) return { ok: false, error: "Enter the billing name" };
  if (address.length < 5 || address.length > 500) return { ok: false, error: "Enter the billing address" };
  if (!isValidStateCode(stateCode)) return { ok: false, error: "Choose the customer's state" };
  if (rawGstin && !isValidGstin(rawGstin)) return { ok: false, error: "GSTIN is not valid" };
  if (rawGstin && stateCodeFromGstin(rawGstin) !== stateCode) {
    return { ok: false, error: "The state must match the first two digits of the GSTIN" };
  }
  return { ok: true, value: { legalName, address, stateCode, gstin: rawGstin || null } };
}

export async function upsertTaxProfile(workspaceId: string, updatedByAuthUserId: string, input: BuyerTaxInput): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  await neon(process.env.DATABASE_URL).query(
    `INSERT INTO app_billing_tax_profiles (workspace_id, legal_name, gstin, state_code, address, updated_by_auth_user_id)
     VALUES ($1::uuid, $2, $3, $4, $5, $6)
     ON CONFLICT (workspace_id) DO UPDATE SET legal_name = EXCLUDED.legal_name, gstin = EXCLUDED.gstin,
       state_code = EXCLUDED.state_code, address = EXCLUDED.address,
       updated_by_auth_user_id = EXCLUDED.updated_by_auth_user_id, updated_at = now()`,
    [workspaceId, input.legalName, input.gstin, input.stateCode, input.address, updatedByAuthUserId]
  );
}

import { isValidGstin, isValidStateCode, stateCodeFromGstin } from "@/lib/billing/gst";

// Seller (Xeccel) tax identity. Invoices are not issued and checkout is refused until these are set,
// so no customer is charged without a compliant tax invoice.
export interface SellerTaxConfig {
  legalName: string;
  gstin: string;
  stateCode: string;
  address: string;
  sacCode: string;
  ratePercent: number;
}

export function sellerTaxConfig(env: Record<string, string | undefined> = process.env): SellerTaxConfig | null {
  const legalName = env.SELLER_LEGAL_NAME;
  const gstin = env.SELLER_GSTIN;
  const address = env.SELLER_ADDRESS;
  const sacCode = env.SAC_CODE || "998314";
  const ratePercent = Number(env.GST_RATE_PERCENT ?? "18");
  if (!legalName || !address || !isValidGstin(gstin) || !Number.isInteger(ratePercent) || ratePercent <= 0) return null;
  const stateCode = stateCodeFromGstin(gstin);
  if (!isValidStateCode(stateCode)) return null;
  if (!/^\d{6,8}$/.test(sacCode)) return null;
  return { legalName, gstin, stateCode, address, sacCode, ratePercent };
}

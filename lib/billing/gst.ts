// GST rules for Indian customers. Rates and place-of-supply logic must be confirmed with a CA
// before go-live; this module only implements the mechanics.

export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

export const GST_RATE_PERCENT = 18;

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Checksum: weighted base-36 sum over the first 14 characters (GSTN standard).
export function gstinCheckCharacter(first14: string): string {
  let sum = 0;
  for (let index = 0; index < 14; index += 1) {
    const value = CHARSET.indexOf(first14[index]);
    if (value < 0) return "";
    const factor = index % 2 === 0 ? 1 : 2;
    const product = value * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36];
}

export function isValidGstin(value: unknown): value is string {
  if (typeof value !== "string" || !GSTIN_PATTERN.test(value)) return false;
  if (!GST_STATE_CODES[value.slice(0, 2)]) return false;
  return gstinCheckCharacter(value.slice(0, 14)) === value[14];
}

export function stateCodeFromGstin(gstin: string): string {
  return gstin.slice(0, 2);
}

export function isValidStateCode(value: unknown): value is string {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(GST_STATE_CODES, value);
}

export interface GstBreakdown {
  baseInrPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalInrPaise: number;
  rateSplit: "intra_state" | "inter_state";
}

// Splits the GST on the base amount. Intra-state supply is CGST + SGST (each half of the rate);
// inter-state supply is IGST. Amounts are integers in paise; tax is rounded half-up per component.
export function computeGst(input: {
  basePaise: number;
  sellerStateCode: string;
  buyerStateCode: string;
  ratePercent?: number;
}): GstBreakdown {
  if (!Number.isInteger(input.basePaise) || input.basePaise <= 0) throw new Error("Base amount must be a positive integer");
  const rate = input.ratePercent ?? GST_RATE_PERCENT;
  const totalTax = Math.round((input.basePaise * rate) / 100);
  if (input.sellerStateCode === input.buyerStateCode) {
    const half = Math.round(totalTax / 2);
    const other = totalTax - half;
    return {
      baseInrPaise: input.basePaise,
      cgstPaise: half,
      sgstPaise: other,
      igstPaise: 0,
      totalInrPaise: input.basePaise + totalTax,
      rateSplit: "intra_state",
    };
  }
  return {
    baseInrPaise: input.basePaise,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: totalTax,
    totalInrPaise: input.basePaise + totalTax,
    rateSplit: "inter_state",
  };
}

// Pro-rata reversal for a credit note expressed as a gross (tax-inclusive) amount.
// Base and tax are reversed in the same proportion as the original invoice.
export function creditNoteSplit(input: {
  invoice: { baseInrPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; totalInrPaise: number };
  grossPaise: number;
}): { basePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; grossPaise: number } {
  const { invoice, grossPaise } = input;
  if (!Number.isInteger(grossPaise) || grossPaise <= 0) throw new Error("Credit amount must be a positive integer");
  if (grossPaise > invoice.totalInrPaise) throw new Error("Credit cannot exceed the invoice total");
  const basePaise = Math.round((grossPaise * invoice.baseInrPaise) / invoice.totalInrPaise);
  const taxPaise = grossPaise - basePaise;
  const invoiceTax = invoice.cgstPaise + invoice.sgstPaise + invoice.igstPaise;
  if (invoiceTax === 0) return { basePaise: grossPaise, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, grossPaise };
  const cgstPaise = Math.round((taxPaise * invoice.cgstPaise) / invoiceTax);
  const igstPaise = invoice.igstPaise > 0 ? taxPaise - cgstPaise : 0;
  const sgstPaise = invoice.igstPaise > 0 ? 0 : taxPaise - cgstPaise;
  return {
    basePaise,
    cgstPaise: invoice.igstPaise > 0 ? 0 : cgstPaise,
    sgstPaise,
    igstPaise,
    grossPaise,
  };
}

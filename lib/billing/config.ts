// Billing settings. Amounts are in paise (INR minor units) so no float math is needed.
// Override via env so pricing can change without a deploy.
export interface BillingConfig {
  currency: "INR";
  pricePerNumberPaise: number;
  interval: "monthly";
  cashfreeEnv: "sandbox" | "production";
}

export function billingConfig(env: NodeJS.ProcessEnv = process.env): BillingConfig {
  const price = Number(env.BILLING_PRICE_PER_NUMBER_PAISE ?? "69900");
  if (!Number.isInteger(price) || price < 0) {
    throw new Error("BILLING_PRICE_PER_NUMBER_PAISE must be a non-negative integer");
  }
  const cashfreeEnv = env.CASHFREE_ENV === "production" ? "production" : "sandbox";
  return { currency: "INR", pricePerNumberPaise: price, interval: "monthly", cashfreeEnv };
}

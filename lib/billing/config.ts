// Billing settings. Amounts are in paise (INR minor units) so no float math is needed.
// Override via env so pricing can change without a deploy.
export interface BillingConfig {
  currency: "INR";
  pricePerNumberPaise: number;
  interval: "monthly";
  cashfreeEnv: "sandbox" | "production";
}

type EnvLike = Record<string, string | undefined>;

export function billingConfig(env: EnvLike = process.env): BillingConfig {
  // No default price: the per-number amount must be set explicitly, so nothing silently bills a stale figure.
  const raw = env.BILLING_PRICE_PER_NUMBER_PAISE;
  if (raw === undefined || raw.trim() === "") {
    throw new Error("BILLING_PRICE_PER_NUMBER_PAISE is not set");
  }
  const price = Number(raw);
  if (!Number.isInteger(price) || price < 0) {
    throw new Error("BILLING_PRICE_PER_NUMBER_PAISE must be a non-negative integer");
  }
  const cashfreeEnv = env.CASHFREE_ENV === "production" ? "production" : "sandbox";
  return { currency: "INR", pricePerNumberPaise: price, interval: "monthly", cashfreeEnv };
}

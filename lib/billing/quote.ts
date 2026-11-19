import type { BillingConfig } from "./config";

// Each active WhatsApp number under a tenant is one billable unit per month.
export interface Quote {
  billableNumbers: number;
  amountPaise: number;
  currency: "INR";
  interval: "monthly";
}

export function quoteMonthly(activeNumberCount: number, config: BillingConfig): Quote {
  if (!Number.isInteger(activeNumberCount) || activeNumberCount < 0) {
    throw new Error("activeNumberCount must be a non-negative integer");
  }
  return {
    billableNumbers: activeNumberCount,
    amountPaise: activeNumberCount * config.pricePerNumberPaise,
    currency: config.currency,
    interval: config.interval,
  };
}

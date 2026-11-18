// Paid add-ons sold alongside a Xeccel plan. Amounts are INR, excluding GST.

export const campaignAddon = {
  name: "Campaigns add-on",
  monthlyPriceInr: 1499,
  includedSends: 10000,
  extraSendPriceInr: 0.1,
} as const;

/** Cost of campaign sends in a month, excluding the monthly add-on fee and Meta's own charges. */
export function campaignExtraCharge(sendsInMonth: number): number {
  const extra = Math.max(0, Math.floor(sendsInMonth) - campaignAddon.includedSends);
  return Math.round(extra * campaignAddon.extraSendPriceInr * 100) / 100;
}

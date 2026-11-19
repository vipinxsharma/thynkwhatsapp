// Order lifecycle for WhatsApp checkout. Pure rules only; the store applies them with guarded UPDATEs.

export const CHECKOUT_STATUSES = ["created", "link_sent", "paid", "failed", "expired"] as const;
export type CheckoutStatus = (typeof CHECKOUT_STATUSES)[number];

const NEXT: Record<CheckoutStatus, readonly CheckoutStatus[]> = {
  created: ["link_sent", "paid", "failed", "expired"],
  link_sent: ["paid", "failed", "expired"],
  failed: ["link_sent", "paid", "expired"],
  expired: ["link_sent", "paid"],
  paid: [],
};

/** True when the order may move from one status to another. Repeating the current status is allowed (idempotent). */
export function canTransition(from: CheckoutStatus, to: CheckoutStatus): boolean {
  return from === to || NEXT[from].includes(to);
}

/** Every status that may transition into `to`. Used as the WHERE filter of a guarded UPDATE. */
export function statusesThatCanEnter(to: CheckoutStatus): CheckoutStatus[] {
  return CHECKOUT_STATUSES.filter((from) => from !== to && canTransition(from, to));
}

/**
 * A new payment link may be issued unless the order is paid or its current link is still live.
 * This stops two active links existing for one order, so a payment can never land on a link we no longer track.
 */
export function canIssuePaymentLink(order: { status: CheckoutStatus; linkExpiresAt: Date | null }, now: Date): boolean {
  if (order.status === "paid") return false;
  if (order.status === "link_sent") return order.linkExpiresAt !== null && order.linkExpiresAt.getTime() <= now.getTime();
  return true;
}

export const MIN_AMOUNT_PAISE = 100;
export const MAX_AMOUNT_PAISE = 50_000_000; // Rs 5,00,000 per order

export type OrderInputResult =
  | { ok: true; amountPaise: number; description: string }
  | { ok: false; error: string };

/** Validates the agent's input. Amounts arrive in rupees with at most two decimals and are stored as paise. */
export function parseOrderInput(input: { amountInr: unknown; description: unknown }): OrderInputResult {
  const { amountInr, description } = input;
  if (typeof amountInr !== "number" || !Number.isFinite(amountInr)) {
    return { ok: false, error: "Enter an amount in rupees" };
  }
  const amountPaise = Math.round(amountInr * 100);
  if (Math.abs(amountPaise - amountInr * 100) > 1e-6 || amountPaise < MIN_AMOUNT_PAISE || amountPaise > MAX_AMOUNT_PAISE) {
    return { ok: false, error: "Amount must be between Rs 1 and Rs 5,00,000 with at most two decimals" };
  }
  if (typeof description !== "string") return { ok: false, error: "Describe what the customer is paying for" };
  const trimmed = description.trim();
  if (trimmed.length < 1 || trimmed.length > 200) {
    return { ok: false, error: "Description must be 1 to 200 characters" };
  }
  return { ok: true, amountPaise, description: trimmed };
}

// Revenue reconciliation: joins click-to-WhatsApp attribution to checkout orders and verified payments.
// Pure: no database or network access, so every rule can be tested with fixtures.
//
// Rules, in short:
// - Revenue is an order with a verified Cashfree payment event with outcome "paid", where the order status is
//   "paid" and the paid amount equals the order amount. An unverified event never counts.
// - An order belongs to the referral its contact had most recently at or before the order was created.
//   An order created before any referral is unattributed.
// - A conversation belongs to the source of its contact's most recent referral.
// - Spend is only used when a spend list is supplied. Without one, spend and ROAS are reported as not synced.

export const REPORT_CURRENCY = "INR" as const;

export type AttributionRecord = {
  contactId: string;
  wamId: string;
  sourceType: "ad" | "post";
  sourceId: string;
  headline: string;
  referredAt: Date;
};

export type ConversationRecord = {
  conversationId: string;
  contactId: string;
};

export type OrderStatus = "created" | "link_sent" | "paid" | "failed" | "expired";

export type OrderRecord = {
  orderId: string;
  contactId: string;
  conversationId: string;
  amountPaise: number;
  status: OrderStatus;
  createdAt: Date;
  paidAmountPaise: number | null;
};

export type PaymentEventRecord = {
  orderId: string;
  verified: boolean;
  outcome: "paid" | "failed" | "expired" | "ignored";
  receivedAt: Date;
};

export type SpendRecord = {
  sourceType: "ad" | "post";
  sourceId: string;
  spendPaise: number;
};

export type ReconciliationInput = {
  attributions: AttributionRecord[];
  conversations: ConversationRecord[];
  orders: OrderRecord[];
  paymentEvents: PaymentEventRecord[];
  /** Omitted or null means no ad spend has been synced for this workspace. */
  spend?: SpendRecord[] | null;
};

/**
 * verified: a verified paid event exists and the order agrees with it (status paid, same amount).
 * unverified_paid: the order says paid but no verified paid event exists. Never revenue.
 * mismatch: a verified paid event exists but the order disagrees with it. Never revenue, flagged for review.
 * open: no paid event yet (created, link sent, failed or expired).
 */
export type OrderClassification = "verified" | "unverified_paid" | "mismatch" | "open";

export type SourceRow = {
  sourceKey: string;
  sourceType: "ad" | "post";
  sourceId: string;
  headline: string;
  attributedConversations: number;
  orders: number;
  verifiedOrders: number;
  verifiedRevenuePaise: number;
  /** null when no spend is synced for this source. */
  spendPaise: number | null;
  /** null unless spend is synced for this source and is above zero. */
  roas: number | null;
};

export type RevenueReport = {
  currency: typeof REPORT_CURRENCY;
  sources: SourceRow[];
  unattributed: { verifiedOrders: number; verifiedRevenuePaise: number };
  totals: {
    attributedConversations: number;
    orders: number;
    verifiedOrders: number;
    verifiedRevenuePaise: number;
    openOrders: number;
    unverifiedPaidOrders: number;
    mismatchedOrders: number;
    unverifiedPaymentEvents: number;
  };
  spend:
    | { status: "not_synced" }
    | { status: "synced"; totalSpendPaise: number; totalRoas: number | null };
};

export function sourceKeyOf(sourceType: "ad" | "post", sourceId: string): string {
  return `${sourceType}:${sourceId}`;
}

/** Decides what an order means for revenue, from its own status and the payment events recorded for it. */
export function classifyOrder(order: OrderRecord, events: PaymentEventRecord[]): OrderClassification {
  const hasVerifiedPaid = events.some((event) => event.verified && event.outcome === "paid");
  if (hasVerifiedPaid) {
    const agrees = order.status === "paid" && order.paidAmountPaise === order.amountPaise;
    return agrees ? "verified" : "mismatch";
  }
  if (order.status === "paid") return "unverified_paid";
  return "open";
}

function byReferralTime(a: AttributionRecord, b: AttributionRecord): number {
  const time = a.referredAt.getTime() - b.referredAt.getTime();
  if (time !== 0) return time;
  return a.wamId < b.wamId ? -1 : a.wamId > b.wamId ? 1 : 0;
}

/** Latest referral for the contact at or before the given moment. Null when there is none. */
function referralAt(
  referralsByContact: Map<string, AttributionRecord[]>,
  contactId: string,
  at: Date,
): AttributionRecord | null {
  const referrals = referralsByContact.get(contactId) ?? [];
  let found: AttributionRecord | null = null;
  for (const referral of referrals) {
    if (referral.referredAt.getTime() <= at.getTime()) found = referral;
  }
  return found;
}

type SourceAccumulator = {
  sourceType: "ad" | "post";
  sourceId: string;
  headline: string;
  headlineAt: number;
  attributedConversations: number;
  orders: number;
  verifiedOrders: number;
  verifiedRevenuePaise: number;
};

export function reconcileRevenue(input: ReconciliationInput): RevenueReport {
  const referralsByContact = new Map<string, AttributionRecord[]>();
  for (const referral of input.attributions) {
    const list = referralsByContact.get(referral.contactId) ?? [];
    list.push(referral);
    referralsByContact.set(referral.contactId, list);
  }
  for (const list of referralsByContact.values()) list.sort(byReferralTime);

  const sources = new Map<string, SourceAccumulator>();
  const ensureSource = (referral: AttributionRecord): SourceAccumulator => {
    const key = sourceKeyOf(referral.sourceType, referral.sourceId);
    let row = sources.get(key);
    if (!row) {
      row = {
        sourceType: referral.sourceType,
        sourceId: referral.sourceId,
        headline: "",
        headlineAt: Number.NEGATIVE_INFINITY,
        attributedConversations: 0,
        orders: 0,
        verifiedOrders: 0,
        verifiedRevenuePaise: 0,
      };
      sources.set(key, row);
    }
    // The headline shown for a source comes from its most recent referral.
    if (referral.referredAt.getTime() >= row.headlineAt) {
      row.headline = referral.headline;
      row.headlineAt = referral.referredAt.getTime();
    }
    return row;
  };
  for (const referral of input.attributions) ensureSource(referral);

  // Conversations: each conversation belongs to its contact's most recent referral. Counted once.
  const seenConversations = new Set<string>();
  let attributedConversations = 0;
  for (const conversation of input.conversations) {
    if (seenConversations.has(conversation.conversationId)) continue;
    seenConversations.add(conversation.conversationId);
    const list = referralsByContact.get(conversation.contactId);
    if (!list || list.length === 0) continue;
    ensureSource(list[list.length - 1]).attributedConversations += 1;
    attributedConversations += 1;
  }

  const eventsByOrder = new Map<string, PaymentEventRecord[]>();
  for (const event of input.paymentEvents) {
    const list = eventsByOrder.get(event.orderId) ?? [];
    list.push(event);
    eventsByOrder.set(event.orderId, list);
  }

  const totals = {
    attributedConversations,
    orders: 0,
    verifiedOrders: 0,
    verifiedRevenuePaise: 0,
    openOrders: 0,
    unverifiedPaidOrders: 0,
    mismatchedOrders: 0,
    unverifiedPaymentEvents: input.paymentEvents.filter((event) => event.outcome === "paid" && !event.verified).length,
  };
  const unattributed = { verifiedOrders: 0, verifiedRevenuePaise: 0 };

  const seenOrders = new Set<string>();
  for (const order of input.orders) {
    if (seenOrders.has(order.orderId)) continue;
    seenOrders.add(order.orderId);
    totals.orders += 1;

    const classification = classifyOrder(order, eventsByOrder.get(order.orderId) ?? []);
    if (classification === "open") totals.openOrders += 1;
    if (classification === "unverified_paid") totals.unverifiedPaidOrders += 1;
    if (classification === "mismatch") totals.mismatchedOrders += 1;

    const referral = referralAt(referralsByContact, order.contactId, order.createdAt);
    const row = referral ? ensureSource(referral) : null;
    if (row) row.orders += 1;

    if (classification !== "verified") continue;
    totals.verifiedOrders += 1;
    totals.verifiedRevenuePaise += order.amountPaise;
    if (row) {
      row.verifiedOrders += 1;
      row.verifiedRevenuePaise += order.amountPaise;
    } else {
      unattributed.verifiedOrders += 1;
      unattributed.verifiedRevenuePaise += order.amountPaise;
    }
  }

  const spendList = input.spend ?? null;
  const spendByKey = new Map<string, number>();
  if (spendList) {
    for (const entry of spendList) spendByKey.set(sourceKeyOf(entry.sourceType, entry.sourceId), entry.spendPaise);
  }

  const rows: SourceRow[] = [...sources.entries()].map(([sourceKey, row]) => {
    const spendPaise = spendList ? (spendByKey.get(sourceKey) ?? null) : null;
    const roas = spendPaise !== null && spendPaise > 0 ? row.verifiedRevenuePaise / spendPaise : null;
    return {
      sourceKey,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      headline: row.headline,
      attributedConversations: row.attributedConversations,
      orders: row.orders,
      verifiedOrders: row.verifiedOrders,
      verifiedRevenuePaise: row.verifiedRevenuePaise,
      spendPaise,
      roas,
    };
  });
  rows.sort((a, b) => {
    if (b.verifiedRevenuePaise !== a.verifiedRevenuePaise) return b.verifiedRevenuePaise - a.verifiedRevenuePaise;
    if (b.attributedConversations !== a.attributedConversations) return b.attributedConversations - a.attributedConversations;
    return a.sourceKey < b.sourceKey ? -1 : a.sourceKey > b.sourceKey ? 1 : 0;
  });

  let spend: RevenueReport["spend"] = { status: "not_synced" };
  if (spendList) {
    const totalSpendPaise = rows.reduce((sum, row) => sum + (row.spendPaise ?? 0), 0);
    const spentRows = rows.filter((row) => row.spendPaise !== null && row.spendPaise > 0);
    const spentRevenue = spentRows.reduce((sum, row) => sum + row.verifiedRevenuePaise, 0);
    const spentTotal = spentRows.reduce((sum, row) => sum + (row.spendPaise ?? 0), 0);
    spend = {
      status: "synced",
      totalSpendPaise,
      totalRoas: spentTotal > 0 ? spentRevenue / spentTotal : null,
    };
  }

  return {
    currency: REPORT_CURRENCY,
    sources: rows,
    unattributed,
    totals,
    spend,
  };
}

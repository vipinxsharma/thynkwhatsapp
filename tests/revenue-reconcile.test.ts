import { describe, expect, it } from "vitest";
import {
  classifyOrder,
  reconcileRevenue,
  type AttributionRecord,
  type OrderRecord,
  type PaymentEventRecord,
  type ReconciliationInput,
} from "../lib/revenue/reconcile";

const day = (dayOfNovember: number) => new Date(Date.UTC(2026, 10, dayOfNovember, 9, 0, 0));

const attributions: AttributionRecord[] = [
  // c1 clicked an ad on 1 Nov, then a post on 10 Nov.
  { contactId: "c1", wamId: "wamid.c1a", sourceType: "ad", sourceId: "A1", headline: "Summer sale", referredAt: day(1) },
  { contactId: "c1", wamId: "wamid.c1p", sourceType: "post", sourceId: "P1", headline: "Launch post", referredAt: day(10) },
  // c2 clicked an ad on 5 Nov.
  { contactId: "c2", wamId: "wamid.c2a", sourceType: "ad", sourceId: "A2", headline: "Retargeting", referredAt: day(5) },
];

const conversations = [
  { conversationId: "conv1", contactId: "c1" },
  { conversationId: "conv1", contactId: "c1" }, // duplicate row must count once
  { conversationId: "conv2", contactId: "c2" },
  { conversationId: "conv3", contactId: "c3" }, // no referral
];

const orders: OrderRecord[] = [
  // Created 3 Nov, after the ad and before the post: attributed to A1. Verified, 1,000.00.
  { orderId: "o1", contactId: "c1", conversationId: "conv1", amountPaise: 100000, status: "paid", createdAt: day(3), paidAmountPaise: 100000 },
  // Created 12 Nov: attributed to P1. Only an unverified paid event, so not revenue.
  { orderId: "o2", contactId: "c1", conversationId: "conv1", amountPaise: 50000, status: "paid", createdAt: day(12), paidAmountPaise: 50000 },
  // Created 6 Nov: attributed to A2. Link sent, still open.
  { orderId: "o3", contactId: "c2", conversationId: "conv2", amountPaise: 200000, status: "link_sent", createdAt: day(6), paidAmountPaise: null },
  // Created 7 Nov: attributed to A2. Verified event says 250.00 but the order says 300.00. Mismatch.
  { orderId: "o4", contactId: "c2", conversationId: "conv2", amountPaise: 30000, status: "paid", createdAt: day(7), paidAmountPaise: 25000 },
  // Contact with no referral: unattributed verified revenue.
  { orderId: "o5", contactId: "c3", conversationId: "conv3", amountPaise: 10000, status: "paid", createdAt: day(8), paidAmountPaise: 10000 },
  // Created 20 Oct, before any referral: unattributed and failed, so open.
  { orderId: "o6", contactId: "c1", conversationId: "conv1", amountPaise: 70000, status: "failed", createdAt: new Date(Date.UTC(2026, 9, 20)), paidAmountPaise: null },
  // Created 2 Nov, before c2's ad on 5 Nov: unattributed verified revenue.
  { orderId: "o7", contactId: "c2", conversationId: "conv2", amountPaise: 45000, status: "paid", createdAt: day(2), paidAmountPaise: 45000 },
];

const paymentEvents: PaymentEventRecord[] = [
  { orderId: "o1", verified: true, outcome: "paid", receivedAt: day(3) },
  { orderId: "o2", verified: false, outcome: "paid", receivedAt: day(12) }, // unverified: must never count
  { orderId: "o4", verified: true, outcome: "paid", receivedAt: day(7) },
  { orderId: "o5", verified: true, outcome: "paid", receivedAt: day(8) },
  { orderId: "o7", verified: true, outcome: "paid", receivedAt: day(2) },
];

const input: ReconciliationInput = { attributions, conversations, orders, paymentEvents };

describe("classifyOrder", () => {
  const base: OrderRecord = {
    orderId: "x",
    contactId: "c",
    conversationId: "conv",
    amountPaise: 1000,
    status: "paid",
    createdAt: day(1),
    paidAmountPaise: 1000,
  };

  it("is verified only when a verified paid event agrees with the order", () => {
    expect(classifyOrder(base, [{ orderId: "x", verified: true, outcome: "paid", receivedAt: day(1) }])).toBe("verified");
  });

  it("is unverified_paid when the order says paid but no verified paid event exists", () => {
    expect(classifyOrder(base, [{ orderId: "x", verified: false, outcome: "paid", receivedAt: day(1) }])).toBe("unverified_paid");
    expect(classifyOrder(base, [])).toBe("unverified_paid");
  });

  it("is mismatch when a verified paid event exists but the amount or status disagrees", () => {
    const verified: PaymentEventRecord = { orderId: "x", verified: true, outcome: "paid", receivedAt: day(1) };
    expect(classifyOrder({ ...base, paidAmountPaise: 900 }, [verified])).toBe("mismatch");
    expect(classifyOrder({ ...base, status: "link_sent" }, [verified])).toBe("mismatch");
  });

  it("is open when no paid event exists and the order is not paid", () => {
    expect(classifyOrder({ ...base, status: "link_sent", paidAmountPaise: null }, [])).toBe("open");
    expect(classifyOrder({ ...base, status: "failed", paidAmountPaise: null }, [])).toBe("open");
  });
});

describe("reconcileRevenue", () => {
  it("counts only verified payments as revenue and reports the rest separately", () => {
    const report = reconcileRevenue(input);

    expect(report.currency).toBe("INR");
    expect(report.totals).toEqual({
      attributedConversations: 2,
      orders: 7,
      verifiedOrders: 3,
      verifiedRevenuePaise: 100000 + 10000 + 45000,
      openOrders: 2,
      unverifiedPaidOrders: 1,
      mismatchedOrders: 1,
      unverifiedPaymentEvents: 1,
    });
  });

  it("attributes each order to the referral current at its creation time", () => {
    const report = reconcileRevenue(input);
    const bySource = Object.fromEntries(report.sources.map((row) => [row.sourceKey, row]));

    // o1 (3 Nov) -> ad:A1. o2 (12 Nov) -> post:P1, but it is unverified.
    expect(bySource["ad:A1"].orders).toBe(1);
    expect(bySource["ad:A1"].verifiedRevenuePaise).toBe(100000);
    expect(bySource["post:P1"].orders).toBe(1);
    expect(bySource["post:P1"].verifiedRevenuePaise).toBe(0);

    // o3 and o4 (6 and 7 Nov) -> ad:A2. o4 is a mismatch, so it adds no revenue.
    expect(bySource["ad:A2"].orders).toBe(2);
    expect(bySource["ad:A2"].verifiedOrders).toBe(0);
  });

  it("keeps verified revenue from orders created before any referral in the unattributed bucket", () => {
    const report = reconcileRevenue(input);
    // o5 (no referral) and o7 (2 Nov, before c2's ad on 5 Nov)
    expect(report.unattributed).toEqual({ verifiedOrders: 2, verifiedRevenuePaise: 55000 });
    expect(report.sources.reduce((sum, row) => sum + row.verifiedRevenuePaise, 0)).toBe(100000);
  });

  it("assigns each conversation to its contact's most recent referral, counted once", () => {
    const report = reconcileRevenue(input);
    const bySource = Object.fromEntries(report.sources.map((row) => [row.sourceKey, row]));

    expect(bySource["post:P1"].attributedConversations).toBe(1); // conv1, latest referral of c1 is the post
    expect(bySource["ad:A2"].attributedConversations).toBe(1); // conv2
    expect(bySource["ad:A1"].attributedConversations).toBe(0);
    expect(report.totals.attributedConversations).toBe(2);
  });

  it("uses the headline from the source's most recent referral and orders sources by verified revenue", () => {
    const report = reconcileRevenue(input);
    expect(report.sources.map((row) => row.sourceKey)).toEqual(["ad:A1", "ad:A2", "post:P1"]);
    expect(report.sources[0].headline).toBe("Summer sale");
  });

  it("does not report spend or ROAS when no spend is synced", () => {
    const report = reconcileRevenue(input);
    expect(report.spend).toEqual({ status: "not_synced" });
    for (const row of report.sources) {
      expect(row.spendPaise).toBeNull();
      expect(row.roas).toBeNull();
    }
  });

  it("reports ROAS only for sources with synced spend above zero", () => {
    const report = reconcileRevenue({
      ...input,
      spend: [
        { sourceType: "ad", sourceId: "A1", spendPaise: 50000 },
        { sourceType: "ad", sourceId: "A2", spendPaise: 0 },
      ],
    });
    const bySource = Object.fromEntries(report.sources.map((row) => [row.sourceKey, row]));

    expect(bySource["ad:A1"].roas).toBe(2);
    expect(bySource["ad:A1"].spendPaise).toBe(50000);
    expect(bySource["ad:A2"].roas).toBeNull(); // spend is zero
    expect(bySource["post:P1"].spendPaise).toBeNull(); // no spend row for this source
    expect(bySource["post:P1"].roas).toBeNull();
    expect(report.spend).toEqual({ status: "synced", totalSpendPaise: 50000, totalRoas: 2 });
  });

  it("treats a referral at exactly the order time as attributed to that referral", () => {
    const report = reconcileRevenue({
      attributions: [{ contactId: "c9", wamId: "w", sourceType: "ad", sourceId: "A9", headline: "", referredAt: day(4) }],
      conversations: [],
      orders: [
        { orderId: "z1", contactId: "c9", conversationId: "cz", amountPaise: 5000, status: "paid", createdAt: day(4), paidAmountPaise: 5000 },
      ],
      paymentEvents: [{ orderId: "z1", verified: true, outcome: "paid", receivedAt: day(4) }],
    });
    expect(report.sources).toHaveLength(1);
    expect(report.sources[0].verifiedRevenuePaise).toBe(5000);
    expect(report.unattributed.verifiedOrders).toBe(0);
  });

  it("returns an empty report when there is no data", () => {
    const report = reconcileRevenue({ attributions: [], conversations: [], orders: [], paymentEvents: [] });
    expect(report.sources).toEqual([]);
    expect(report.totals.verifiedRevenuePaise).toBe(0);
    expect(report.totals.orders).toBe(0);
    expect(report.spend).toEqual({ status: "not_synced" });
  });
});

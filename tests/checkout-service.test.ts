import { describe, expect, it } from "vitest";
import {
  createCheckoutOrder,
  issuePaymentLink,
  processCheckoutEvent,
  type CheckoutOrderRecord,
  type CheckoutStore,
} from "../lib/checkout/service";
import type { CheckoutStatus } from "../lib/checkout/state";
import { statusesThatCanEnter } from "../lib/checkout/state";
import { parseCheckoutWebhook } from "../lib/checkout/webhook";
import type { PaymentLinkSnapshot } from "../lib/checkout/cashfree-links";

const WORKSPACE = "11111111-1111-4111-8111-111111111111";
const CONVERSATION = "22222222-2222-4222-8222-222222222222";
const CONTACT = "33333333-3333-4333-8333-333333333333";
const ORDER = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-11-19T10:00:00Z");
const TTL = 48 * 60 * 60 * 1000;

// In-memory store that applies the same guards as the Postgres store.
function memoryStore(seed: Partial<CheckoutOrderRecord>[] = []) {
  const orders = new Map<string, CheckoutOrderRecord & { paidAt?: Date; paymentRef?: string | null }>();
  for (const o of seed) orders.set(o.id!, { ...base(), ...o } as CheckoutOrderRecord);
  const events = new Map<string, { outcome: string; confirmed: boolean }>();
  const store: CheckoutStore = {
    async findOrderByLinkId(linkId) {
      return [...orders.values()].find((o) => o.cashfreeLinkId === linkId) ?? null;
    },
    async findOrder(workspaceId, orderId) {
      const o = orders.get(orderId);
      return o && o.workspaceId === workspaceId ? o : null;
    },
    async findConversationContact(workspaceId, conversationId) {
      return workspaceId === WORKSPACE && conversationId === CONVERSATION
        ? { contactId: CONTACT, name: "Asha", phoneNumber: "919876543210" }
        : null;
    },
    async insertOrder(order) {
      orders.set(order.id, { ...base(), id: order.id, workspaceId: order.workspaceId, contactId: order.contactId, conversationId: order.conversationId, description: order.description, amountPaise: order.amountPaise });
    },
    async attachPaymentLink({ workspaceId, orderId, linkId, linkUrl, expiresAt, now }) {
      const o = orders.get(orderId);
      if (!o || o.workspaceId !== workspaceId) return false;
      const allowed = o.status === "created" || o.status === "failed" || o.status === "expired" ||
        (o.status === "link_sent" && o.linkExpiresAt !== null && o.linkExpiresAt.getTime() <= now.getTime());
      if (!allowed) return false;
      Object.assign(o, { status: "link_sent", cashfreeLinkId: linkId, paymentLinkUrl: linkUrl, linkExpiresAt: expiresAt });
      return true;
    },
    async markPaid({ orderId, paidAmountPaise, paymentRef, now }) {
      const o = orders.get(orderId)!;
      if (!statusesThatCanEnter("paid").includes(o.status) || o.amountPaise !== paidAmountPaise) return false;
      Object.assign(o, { status: "paid", paidAt: now, paymentRef });
      return true;
    },
    async markFailedOrExpired({ orderId, to }) {
      const o = orders.get(orderId)!;
      if (!statusesThatCanEnter(to).includes(o.status)) return false;
      o.status = to;
      return true;
    },
    async recordEvent({ eventKey, outcome, confirmed }) {
      if (events.has(eventKey)) return false;
      events.set(eventKey, { outcome, confirmed });
      return true;
    },
  };
  return { store, orders, events };
}

function base(): CheckoutOrderRecord & { paidAt?: Date; paymentRef?: string | null } {
  return {
    id: ORDER,
    workspaceId: WORKSPACE,
    contactId: CONTACT,
    conversationId: CONVERSATION,
    description: "Blue kurta",
    amountPaise: 49950,
    status: "created" as CheckoutStatus,
    cashfreeLinkId: null,
    paymentLinkUrl: null,
    linkExpiresAt: null,
    customerName: "Asha",
    customerPhone: "9876543210",
  };
}

function issuer(linkId = "co_linkone") {
  return {
    create: async (input: { linkId: string }) => ({ linkId: input.linkId || linkId, linkUrl: `https://pay.example/${input.linkId}` }),
  };
}

function eventFrom(body: object) {
  const parsed = parseCheckoutWebhook(JSON.stringify(body));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.event;
}

const paidEvent = (linkId: string, payment = "pay-1") =>
  eventFrom({ type: "PAYMENT_SUCCESS_WEBHOOK", data: { link_id: linkId, payment: { cf_payment_id: payment, payment_status: "SUCCESS" } } });

function fetchLinkReturning(snapshot: PaymentLinkSnapshot | null) {
  const calls: string[] = [];
  return {
    calls,
    fetchLink: async (linkId: string) => {
      calls.push(linkId);
      return snapshot;
    },
  };
}

describe("creating an order", () => {
  it("links the order to the conversation's contact and workspace", async () => {
    const { store, orders } = memoryStore();
    const result = await createCheckoutOrder(store, {
      workspaceId: WORKSPACE,
      conversationId: CONVERSATION,
      actorUserId: "user-1",
      amountPaise: 49950,
      description: "Blue kurta",
      newId: () => ORDER,
    });
    expect(result).toEqual({ ok: true, orderId: ORDER });
    expect(orders.get(ORDER)).toMatchObject({ contactId: CONTACT, conversationId: CONVERSATION, status: "created" });
  });

  it("does not create an order for another workspace's conversation", async () => {
    const { store } = memoryStore();
    const result = await createCheckoutOrder(store, {
      workspaceId: "99999999-9999-4999-8999-999999999999",
      conversationId: CONVERSATION,
      actorUserId: "user-1",
      amountPaise: 100,
      description: "x",
      newId: () => ORDER,
    });
    expect(result).toEqual({ ok: false, status: 404, error: "Conversation not found" });
  });
});

describe("issuing a payment link", () => {
  it("creates the link and moves the order to link_sent", async () => {
    const { store, orders } = memoryStore([{ id: ORDER, status: "created" }]);
    const result = await issuePaymentLink(
      { store, issuer: issuer(), now: NOW, newLinkId: () => "co_linkone", linkTtlMs: TTL },
      { workspaceId: WORKSPACE, orderId: ORDER }
    );
    expect(result).toMatchObject({ ok: true, linkId: "co_linkone", linkUrl: "https://pay.example/co_linkone" });
    expect(orders.get(ORDER)).toMatchObject({ status: "link_sent", cashfreeLinkId: "co_linkone" });
  });

  it("refuses while the current link is still live, so a payment cannot land on an untracked link", async () => {
    const { store } = memoryStore([{ id: ORDER, status: "link_sent", cashfreeLinkId: "co_old", linkExpiresAt: new Date(NOW.getTime() + 1000) }]);
    const result = await issuePaymentLink(
      { store, issuer: issuer(), now: NOW, newLinkId: () => "co_new", linkTtlMs: TTL },
      { workspaceId: WORKSPACE, orderId: ORDER }
    );
    expect(result).toMatchObject({ ok: false, status: 409 });
  });

  it("issues a new link after the old one has expired", async () => {
    const { store, orders } = memoryStore([{ id: ORDER, status: "link_sent", cashfreeLinkId: "co_old", linkExpiresAt: new Date(NOW.getTime() - 1000) }]);
    const result = await issuePaymentLink(
      { store, issuer: issuer(), now: NOW, newLinkId: () => "co_new", linkTtlMs: TTL },
      { workspaceId: WORKSPACE, orderId: ORDER }
    );
    expect(result).toMatchObject({ ok: true, linkId: "co_new" });
    expect(orders.get(ORDER)?.cashfreeLinkId).toBe("co_new");
  });

  it("refuses a paid order", async () => {
    const { store } = memoryStore([{ id: ORDER, status: "paid" }]);
    const result = await issuePaymentLink(
      { store, issuer: issuer(), now: NOW, newLinkId: () => "co_x", linkTtlMs: TTL },
      { workspaceId: WORKSPACE, orderId: ORDER }
    );
    expect(result).toMatchObject({ ok: false, status: 409, error: "This order is already paid" });
  });

  it("does not store a link when Cashfree fails, and reports a gateway error", async () => {
    const { store, orders } = memoryStore([{ id: ORDER, status: "created" }]);
    const result = await issuePaymentLink(
      {
        store,
        issuer: { create: async () => { throw new Error("cashfree down"); } },
        now: NOW,
        newLinkId: () => "co_x",
        linkTtlMs: TTL,
      },
      { workspaceId: WORKSPACE, orderId: ORDER }
    );
    expect(result).toMatchObject({ ok: false, status: 502 });
    expect(orders.get(ORDER)?.status).toBe("created");
  });

  it("does not find orders from another workspace", async () => {
    const { store } = memoryStore([{ id: ORDER, status: "created" }]);
    const result = await issuePaymentLink(
      { store, issuer: issuer(), now: NOW, newLinkId: () => "co_x", linkTtlMs: TTL },
      { workspaceId: "99999999-9999-4999-8999-999999999999", orderId: ORDER }
    );
    expect(result).toMatchObject({ ok: false, status: 404 });
  });
});

describe("payment webhook", () => {
  const paidSnapshot = (amount = 49950): PaymentLinkSnapshot => ({ linkStatus: "PAID", amountPaidPaise: amount });

  it("marks the order paid only when Cashfree confirms PAID for the full amount", async () => {
    const { store, orders } = memoryStore([{ id: ORDER, status: "link_sent", cashfreeLinkId: "co_1" }]);
    const probe = fetchLinkReturning(paidSnapshot());
    const result = await processCheckoutEvent({ store, fetchLink: probe.fetchLink, now: NOW }, paidEvent("co_1"));

    expect(result).toEqual({ handled: true, outcome: "paid", duplicate: false });
    expect(probe.calls).toEqual(["co_1"]);
    expect(orders.get(ORDER)).toMatchObject({ status: "paid", paymentRef: "pay-1" });
  });

  it("does not mark paid on a webhook alone when Cashfree still reports the link active", async () => {
    const { store, orders, events } = memoryStore([{ id: ORDER, status: "link_sent", cashfreeLinkId: "co_1" }]);
    const result = await processCheckoutEvent(
      { store, fetchLink: fetchLinkReturning({ linkStatus: "ACTIVE", amountPaidPaise: null }).fetchLink, now: NOW },
      paidEvent("co_1")
    );
    expect(result).toMatchObject({ handled: true, outcome: "ignored" });
    expect(orders.get(ORDER)?.status).toBe("link_sent");
    expect([...events.values()]).toEqual([{ outcome: "ignored", confirmed: false }]);
  });

  it("does not mark paid when the confirmed amount differs from the order", async () => {
    const { store, orders } = memoryStore([{ id: ORDER, status: "link_sent", cashfreeLinkId: "co_1" }]);
    const result = await processCheckoutEvent(
      { store, fetchLink: fetchLinkReturning(paidSnapshot(100)).fetchLink, now: NOW },
      paidEvent("co_1")
    );
    expect(result).toMatchObject({ outcome: "ignored" });
    expect(orders.get(ORDER)?.status).toBe("link_sent");
  });

  it("does not mark paid when Cashfree cannot be reached", async () => {
    const { store, orders } = memoryStore([{ id: ORDER, status: "link_sent", cashfreeLinkId: "co_1" }]);
    await processCheckoutEvent({ store, fetchLink: fetchLinkReturning(null).fetchLink, now: NOW }, paidEvent("co_1"));
    expect(orders.get(ORDER)?.status).toBe("link_sent");
  });

  it("treats a redelivered payment as a duplicate and does not change the order again", async () => {
    const { store, orders, events } = memoryStore([{ id: ORDER, status: "link_sent", cashfreeLinkId: "co_1" }]);
    const deps = { store, fetchLink: fetchLinkReturning(paidSnapshot()).fetchLink, now: NOW };
    const first = await processCheckoutEvent(deps, paidEvent("co_1"));
    const second = await processCheckoutEvent(deps, paidEvent("co_1"));

    expect(first).toEqual({ handled: true, outcome: "paid", duplicate: false });
    expect(second).toEqual({ handled: true, outcome: "paid", duplicate: true });
    expect(events.size).toBe(1);
    expect(orders.get(ORDER)).toMatchObject({ status: "paid", paymentRef: "pay-1" });
  });

  it("keeps a paid order paid when a later failed attempt arrives", async () => {
    const { store, orders } = memoryStore([{ id: ORDER, status: "link_sent", cashfreeLinkId: "co_1" }]);
    const deps = { store, fetchLink: fetchLinkReturning(paidSnapshot()).fetchLink, now: NOW };
    await processCheckoutEvent(deps, paidEvent("co_1"));
    const failed = eventFrom({ type: "PAYMENT_FAILED_WEBHOOK", data: { link_id: "co_1", payment: { cf_payment_id: "pay-2", payment_status: "FAILED" } } });
    const result = await processCheckoutEvent(deps, failed);

    expect(result).toMatchObject({ outcome: "failed", duplicate: false });
    expect(orders.get(ORDER)?.status).toBe("paid");
  });

  it("records a failed attempt on a link_sent order so it can still be paid later", async () => {
    const { store, orders } = memoryStore([{ id: ORDER, status: "link_sent", cashfreeLinkId: "co_1" }]);
    const deps = { store, fetchLink: fetchLinkReturning(paidSnapshot()).fetchLink, now: NOW };
    const failed = eventFrom({ type: "PAYMENT_FAILED_WEBHOOK", data: { link_id: "co_1", payment: { cf_payment_id: "pay-1", payment_status: "FAILED" } } });
    await processCheckoutEvent(deps, failed);
    expect(orders.get(ORDER)?.status).toBe("failed");

    await processCheckoutEvent(deps, paidEvent("co_1", "pay-3"));
    expect(orders.get(ORDER)?.status).toBe("paid");
  });

  it("expires an order only when Cashfree confirms the link is expired", async () => {
    const { store, orders } = memoryStore([{ id: ORDER, status: "link_sent", cashfreeLinkId: "co_1" }]);
    const expiredEvent = eventFrom({ type: "PAYMENT_LINK_EVENT", data: { link_id: "co_1", link_status: "EXPIRED" } });
    const notConfirmed = await processCheckoutEvent({ store, fetchLink: fetchLinkReturning({ linkStatus: "ACTIVE", amountPaidPaise: null }).fetchLink, now: NOW }, expiredEvent);
    expect(notConfirmed.handled && notConfirmed.outcome).toBe("ignored");
    expect(orders.get(ORDER)?.status).toBe("link_sent");

    const confirmed = await processCheckoutEvent({ store, fetchLink: fetchLinkReturning({ linkStatus: "EXPIRED", amountPaidPaise: null }).fetchLink, now: NOW }, expiredEvent);
    expect(confirmed).toMatchObject({ outcome: "expired" });
    expect(orders.get(ORDER)?.status).toBe("expired");
  });

  it("does not link-expire a paid order", async () => {
    const { store, orders } = memoryStore([{ id: ORDER, status: "paid", cashfreeLinkId: "co_1", paymentRef: "pay-1" } as Partial<CheckoutOrderRecord>]);
    const expiredEvent = eventFrom({ type: "PAYMENT_LINK_EVENT", data: { link_id: "co_1", link_status: "EXPIRED" } });
    await processCheckoutEvent({ store, fetchLink: fetchLinkReturning({ linkStatus: "EXPIRED", amountPaidPaise: null }).fetchLink, now: NOW }, expiredEvent);
    expect(orders.get(ORDER)?.status).toBe("paid");
  });

  it("ignores events for links we did not issue, and events without a link", async () => {
    const { store, events } = memoryStore([{ id: ORDER, status: "link_sent", cashfreeLinkId: "co_1" }]);
    const deps = { store, fetchLink: fetchLinkReturning(paidSnapshot()).fetchLink, now: NOW };
    expect(await processCheckoutEvent(deps, paidEvent("co_unknown"))).toEqual({ handled: false, reason: "unknown_link" });
    const noLink = eventFrom({ type: "PAYMENT_SUCCESS_WEBHOOK", data: {} });
    expect(await processCheckoutEvent(deps, noLink)).toEqual({ handled: false, reason: "no_link" });
    expect(events.size).toBe(0);
  });
});

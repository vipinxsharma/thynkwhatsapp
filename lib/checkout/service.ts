// Order lifecycle orchestration. Storage and Cashfree are injected so the rules can be tested without a database or network.
import { canIssuePaymentLink, type CheckoutStatus } from "@/lib/checkout/state";
import type { CheckoutWebhookEvent } from "@/lib/checkout/webhook";
import type { PaymentLinkSnapshot } from "@/lib/checkout/cashfree-links";

export interface CheckoutOrderRecord {
  id: string;
  workspaceId: string;
  contactId: string;
  conversationId: string;
  description: string;
  amountPaise: number;
  status: CheckoutStatus;
  cashfreeLinkId: string | null;
  paymentLinkUrl: string | null;
  linkExpiresAt: Date | null;
  customerName: string;
  customerPhone: string;
}

export interface CheckoutStore {
  findOrderByLinkId(linkId: string): Promise<CheckoutOrderRecord | null>;
  findOrder(workspaceId: string, orderId: string): Promise<CheckoutOrderRecord | null>;
  findConversationContact(
    workspaceId: string,
    conversationId: string
  ): Promise<{ contactId: string; name: string; phoneNumber: string } | null>;
  insertOrder(order: {
    id: string;
    workspaceId: string;
    contactId: string;
    conversationId: string;
    description: string;
    amountPaise: number;
    actorUserId: string;
  }): Promise<void>;
  /** Stores a newly issued link and moves the order to link_sent. Returns false if the guard no longer holds. */
  attachPaymentLink(input: {
    workspaceId: string;
    orderId: string;
    linkId: string;
    linkUrl: string;
    expiresAt: Date;
    now: Date;
  }): Promise<boolean>;
  /** Moves to paid. Only called after a verified payment. Returns false when the order is already paid. */
  markPaid(input: { workspaceId: string; orderId: string; paidAmountPaise: number; paymentRef: string; now: Date }): Promise<boolean>;
  markFailedOrExpired(input: { workspaceId: string; orderId: string; to: "failed" | "expired"; now: Date }): Promise<boolean>;
  /** Returns true when the event was new, false when it was already recorded. */
  recordEvent(input: {
    workspaceId: string;
    orderId: string;
    eventKey: string;
    eventType: string;
    providerStatus: string;
    paymentRef: string | null;
    confirmed: boolean;
    outcome: "paid" | "failed" | "expired" | "ignored";
    payload: Record<string, unknown>;
  }): Promise<boolean>;
}

export type CreateOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; status: 400 | 404; error: string };

export async function createCheckoutOrder(
  store: CheckoutStore,
  input: {
    workspaceId: string;
    conversationId: string;
    actorUserId: string;
    amountPaise: number;
    description: string;
    newId: () => string;
  }
): Promise<CreateOrderResult> {
  const contact = await store.findConversationContact(input.workspaceId, input.conversationId);
  if (!contact) return { ok: false, status: 404, error: "Conversation not found" };
  const id = input.newId();
  await store.insertOrder({
    id,
    workspaceId: input.workspaceId,
    contactId: contact.contactId,
    conversationId: input.conversationId,
    description: input.description,
    amountPaise: input.amountPaise,
    actorUserId: input.actorUserId,
  });
  return { ok: true, orderId: id };
}

export type IssueLinkResult =
  | { ok: true; orderId: string; linkId: string; linkUrl: string; expiresAt: Date }
  | { ok: false; status: 404 | 409 | 502; error: string };

export interface LinkIssuer {
  create(input: {
    linkId: string;
    amountPaise: number;
    description: string;
    customerName: string;
    customerPhone: string;
    expiresAt: Date;
  }): Promise<{ linkId: string; linkUrl: string }>;
}

/** Creates a Cashfree link for an open order and records it. Refuses while a previous link is still live. */
export async function issuePaymentLink(
  deps: { store: CheckoutStore; issuer: LinkIssuer; now: Date; newLinkId: () => string; linkTtlMs: number },
  input: { workspaceId: string; orderId: string }
): Promise<IssueLinkResult> {
  const order = await deps.store.findOrder(input.workspaceId, input.orderId);
  if (!order) return { ok: false, status: 404, error: "Order not found" };
  if (!canIssuePaymentLink({ status: order.status, linkExpiresAt: order.linkExpiresAt }, deps.now)) {
    return {
      ok: false,
      status: 409,
      error: order.status === "paid" ? "This order is already paid" : "A payment link is already active for this order",
    };
  }

  const linkId = deps.newLinkId();
  const expiresAt = new Date(deps.now.getTime() + deps.linkTtlMs);
  let issued: { linkId: string; linkUrl: string };
  try {
    issued = await deps.issuer.create({
      linkId,
      amountPaise: order.amountPaise,
      description: order.description,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      expiresAt,
    });
  } catch {
    return { ok: false, status: 502, error: "Could not create the payment link. Try again shortly." };
  }

  const attached = await deps.store.attachPaymentLink({
    workspaceId: input.workspaceId,
    orderId: input.orderId,
    linkId: issued.linkId,
    linkUrl: issued.linkUrl,
    expiresAt,
    now: deps.now,
  });
  if (!attached) {
    // Only possible if the order was paid or re-linked between the read and the write.
    return { ok: false, status: 409, error: "The order changed while the link was being created. Reload and try again." };
  }
  return { ok: true, orderId: input.orderId, linkId: issued.linkId, linkUrl: issued.linkUrl, expiresAt };
}

export type WebhookResult =
  | { handled: false; reason: "no_link" | "unknown_link" }
  | { handled: true; outcome: "paid" | "failed" | "expired" | "ignored"; duplicate: boolean };

/**
 * Applies a signed Cashfree event. The caller has already verified the signature.
 * Paid is decided from Cashfree's own link status and paid amount, never from the webhook body alone.
 * Order changes run before the event is recorded, so a failed write is retried on redelivery (all changes are idempotent).
 */
export async function processCheckoutEvent(
  deps: { store: CheckoutStore; fetchLink: (linkId: string) => Promise<PaymentLinkSnapshot | null>; now: Date },
  event: CheckoutWebhookEvent
): Promise<WebhookResult> {
  if (!event.linkId) return { handled: false, reason: "no_link" };
  const order = await deps.store.findOrderByLinkId(event.linkId);
  if (!order) return { handled: false, reason: "unknown_link" };

  const wantsPaidCheck = event.kind === "payment_success" || (event.kind === "link_status" && event.providerStatus === "PAID");
  const wantsExpiredCheck = event.kind === "link_status" && event.providerStatus === "EXPIRED";
  let outcome: "paid" | "failed" | "expired" | "ignored" = "ignored";
  let confirmed = false;

  if (wantsPaidCheck || wantsExpiredCheck) {
    const snapshot = await deps.fetchLink(event.linkId);
    if (snapshot && wantsPaidCheck && snapshot.linkStatus === "PAID" && snapshot.amountPaidPaise === order.amountPaise) {
      confirmed = true;
      outcome = "paid";
      await deps.store.markPaid({
        workspaceId: order.workspaceId,
        orderId: order.id,
        paidAmountPaise: order.amountPaise,
        paymentRef: event.paymentRef ?? `link:${event.linkId}`,
        now: deps.now,
      });
    } else if (snapshot && wantsExpiredCheck && snapshot.linkStatus === "EXPIRED") {
      confirmed = true;
      outcome = "expired";
      await deps.store.markFailedOrExpired({ workspaceId: order.workspaceId, orderId: order.id, to: "expired", now: deps.now });
    }
  } else if (event.kind === "payment_failed") {
    // A failed attempt does not end the link, so the order records the failure and can still be paid later.
    outcome = "failed";
    await deps.store.markFailedOrExpired({ workspaceId: order.workspaceId, orderId: order.id, to: "failed", now: deps.now });
  }

  const inserted = await deps.store.recordEvent({
    workspaceId: order.workspaceId,
    orderId: order.id,
    eventKey: event.eventKey,
    eventType: event.eventType,
    providerStatus: event.providerStatus,
    paymentRef: event.paymentRef,
    confirmed,
    outcome,
    payload: event.payload,
  });
  return { handled: true, outcome, duplicate: !inserted };
}

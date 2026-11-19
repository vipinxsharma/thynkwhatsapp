// Cashfree Payment Links for customer checkout. Uses the same credentials as subscription billing
// (lib/billing/cashfree.ts) but its own endpoints. Tests inject `fetchImpl`, so nothing calls Cashfree live.
import type { CashfreeCredentials } from "@/lib/billing/cashfree";

const API_VERSION = "2023-08-01";

function baseUrl(env: CashfreeCredentials["env"]): string {
  return env === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

function headers(creds: CashfreeCredentials): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-version": API_VERSION,
    "x-client-id": creds.clientId,
    "x-client-secret": creds.clientSecret,
  };
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface PaymentLinkInput {
  linkId: string;
  amountPaise: number;
  description: string;
  customerName: string;
  customerPhone: string; // 10-digit Indian mobile, as stored on the contact
  expiresAt: Date;
  notifyUrl: string;
  returnUrl: string | null;
}

export interface IssuedPaymentLink {
  linkId: string;
  linkUrl: string;
}

export function paiseToRupeesString(paise: number): string {
  return (paise / 100).toFixed(2);
}

export async function createCashfreePaymentLink(
  creds: CashfreeCredentials,
  input: PaymentLinkInput,
  fetchImpl: FetchLike = fetch
): Promise<IssuedPaymentLink> {
  const meta: Record<string, string> = { notify_url: input.notifyUrl };
  if (input.returnUrl) meta.return_url = input.returnUrl;

  const response = await fetchImpl(`${baseUrl(creds.env)}/links`, {
    method: "POST",
    headers: headers(creds),
    body: JSON.stringify({
      link_id: input.linkId,
      link_amount: Number(paiseToRupeesString(input.amountPaise)),
      link_currency: "INR",
      link_purpose: input.description,
      customer_details: { customer_name: input.customerName, customer_phone: input.customerPhone },
      // WhatsApp sends the link from our inbox, so Cashfree should not send its own SMS or email.
      link_notify: { send_sms: false, send_email: false },
      link_meta: meta,
      link_expiry_time: input.expiresAt.toISOString(),
      link_partial_payments: false,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { link_url?: string; link_id?: string; message?: string };
  if (!response.ok || !payload.link_url) {
    throw new Error(`Cashfree payment link failed: ${payload.message || response.status}`);
  }
  return { linkId: payload.link_id || input.linkId, linkUrl: payload.link_url };
}

/** What Cashfree reports for a link when we ask it directly. The payment webhook alone is never enough to mark paid. */
export interface PaymentLinkSnapshot {
  linkStatus: string | null; // e.g. ACTIVE, PAID, EXPIRED, CANCELLED
  amountPaidPaise: number | null;
}

export async function fetchCashfreePaymentLink(
  creds: CashfreeCredentials,
  linkId: string,
  fetchImpl: FetchLike = fetch
): Promise<PaymentLinkSnapshot | null> {
  const response = await fetchImpl(`${baseUrl(creds.env)}/links/${encodeURIComponent(linkId)}`, {
    headers: headers(creds),
  });
  if (!response.ok) return null;
  const payload = (await response.json().catch(() => ({}))) as { link_status?: string; link_amount_paid?: number };
  const paid = typeof payload.link_amount_paid === "number" && Number.isFinite(payload.link_amount_paid)
    ? Math.round(payload.link_amount_paid * 100)
    : null;
  return { linkStatus: payload.link_status ?? null, amountPaidPaise: paid };
}

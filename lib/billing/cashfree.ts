// Cashfree Payment Gateway client. Sandbox is the default; production needs CASHFREE_ENV=production.
const API_VERSION = "2023-08-01";

export interface CashfreeCredentials {
  clientId: string;
  clientSecret: string;
  env: "sandbox" | "production";
}

export function cashfreeCredentials(env: Record<string, string | undefined> = process.env): CashfreeCredentials | null {
  const clientId = env.CASHFREE_CLIENT_ID;
  const clientSecret = env.CASHFREE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    env: env.CASHFREE_ENV === "production" ? "production" : "sandbox",
  };
}

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

export interface CreateOrderInput {
  orderId: string;
  amountInr: number;
  customerId: string;
  customerEmail: string;
  customerPhone: string;
  returnUrl: string;
  notifyUrl: string;
}

export async function createCashfreeOrder(
  creds: CashfreeCredentials,
  input: CreateOrderInput
): Promise<{ paymentSessionId: string }> {
  const response = await fetch(`${baseUrl(creds.env)}/orders`, {
    method: "POST",
    headers: headers(creds),
    body: JSON.stringify({
      order_id: input.orderId,
      order_amount: input.amountInr,
      order_currency: "INR",
      customer_details: {
        customer_id: input.customerId,
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone,
      },
      order_meta: { return_url: input.returnUrl, notify_url: input.notifyUrl },
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { payment_session_id?: string; message?: string };
  if (!response.ok || !payload.payment_session_id) {
    throw new Error(`Cashfree order creation failed: ${payload.message || response.status}`);
  }
  return { paymentSessionId: payload.payment_session_id };
}

// Server-side status check. The webhook and this call are the only sources that may activate a plan.
export async function fetchCashfreeOrderStatus(
  creds: CashfreeCredentials,
  orderId: string
): Promise<string | null> {
  const response = await fetch(`${baseUrl(creds.env)}/orders/${encodeURIComponent(orderId)}`, {
    headers: headers(creds),
  });
  if (!response.ok) return null;
  const payload = (await response.json().catch(() => ({}))) as { order_status?: string };
  return payload.order_status ?? null;
}

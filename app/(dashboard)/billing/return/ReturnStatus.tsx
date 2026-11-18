"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Polls the server, which checks Cashfree directly. The page never marks anything paid itself.
export function ReturnStatus() {
  const [message, setMessage] = useState("Confirming your payment…");

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("order_id");
    if (!orderId) {
      setMessage("This payment link is incomplete. Open Plan from the menu to check your payment.");
      return;
    }
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      attempts += 1;
      try {
        const response = await fetch(`/api/billing/orders/${encodeURIComponent(orderId as string)}`, { cache: "no-store" });
        const payload = await response.json();
        if (payload.status === "paid") {
          window.location.replace("/settings/waba?payment=success");
          return;
        }
        if (payload.status === "failed" || payload.status === "expired") {
          setMessage("Your payment was not completed. You can try again from the Plan page.");
          return;
        }
      } catch {
        // Retry below.
      }
      if (attempts >= 20) {
        setMessage("We are still waiting for the bank to confirm. Refresh this page in a minute.");
        return;
      }
      timer = setTimeout(check, 3000);
    }
    check();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-4 p-8 text-center">
      <h1 className="text-2xl font-bold">Payment</h1>
      <p className="text-sm text-[var(--muted)]">{message}</p>
      <Link href="/billing" className="text-sm underline">Back to plans</Link>
    </div>
  );
}

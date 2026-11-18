"use client";

import { useState } from "react";
import Link from "next/link";
import { billingPlans } from "@/lib/billing/plans";

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => {
      checkout: (options: { paymentSessionId: string; redirectTarget?: string }) => Promise<unknown>;
    };
  }
}

const SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";

function loadCashfreeSdk(): Promise<void> {
  if (window.Cashfree) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment form"));
    document.body.appendChild(script);
  });
}

export function BillingPlanPicker({ canPay, welcome }: { canPay: boolean; welcome: boolean }) {
  const [phone, setPhone] = useState("");
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function choose(planId: string) {
    setError("");
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Enter a valid 10-digit mobile number first.");
      return;
    }
    setPendingPlan(planId);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, phone }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not start checkout");
      await loadCashfreeSdk();
      if (!window.Cashfree) throw new Error("Payment form is unavailable");
      const cashfree = window.Cashfree({ mode: payload.data.environment === "production" ? "production" : "sandbox" });
      await cashfree.checkout({ paymentSessionId: payload.data.paymentSessionId, redirectTarget: "_self" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start checkout");
      setPendingPlan(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">Plan</p>
        <h1 className="mt-2 text-2xl font-bold">{welcome ? "Welcome. Choose your plan" : "Choose your plan"}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Prices exclude GST. You can skip this step and come back to it later from the menu.
        </p>
      </div>

      {!canPay && (
        <p className="rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--muted)]">
          Only the workspace owner or an admin can choose a plan. Ask them to complete checkout.
        </p>
      )}

      {canPay && (
        <label className="block max-w-sm text-sm">
          <span className="mb-1 block font-semibold">Mobile number for the payment receipt</span>
          <input
            inputMode="numeric"
            maxLength={10}
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
            placeholder="10-digit mobile"
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2"
          />
        </label>
      )}

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {billingPlans.map((plan) => (
          <article key={plan.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-xs uppercase tracking-wider text-[var(--muted)]">{plan.term} · {plan.days}</p>
            <h2 className="mt-1 font-semibold">{plan.name}</h2>
            <p className="mt-2 text-2xl font-bold">₹{plan.priceInr.toLocaleString("en-IN")}<span className="text-sm font-normal text-[var(--muted)]"> / {plan.period}</span></p>
            <button
              type="button"
              disabled={!canPay || pendingPlan !== null}
              onClick={() => choose(plan.id)}
              className="mt-4 rounded-lg bg-whatsapp px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {pendingPlan === plan.id ? "Opening payment…" : "Choose and pay"}
            </button>
          </article>
        ))}
      </div>

      <Link href="/dashboard" className="inline-block text-sm text-[var(--muted)] underline">Skip for now</Link>
    </div>
  );
}

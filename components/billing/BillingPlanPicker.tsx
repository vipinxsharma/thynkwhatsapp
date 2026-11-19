"use client";

import { useState } from "react";
import Link from "next/link";
import { billingPlans, type BillingPlan } from "@/lib/billing/plans";
import { computeGst, GST_STATE_CODES } from "@/lib/billing/gst";

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

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function BillingPlanPicker({
  canPay,
  welcome,
  sellerStateCode,
  sellerReady,
}: {
  canPay: boolean;
  welcome: boolean;
  sellerStateCode: string | null;
  sellerReady: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [legalName, setLegalName] = useState("");
  const [address, setAddress] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [gstin, setGstin] = useState("");
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");

  function preview(plan: BillingPlan) {
    if (!sellerStateCode || !stateCode) return null;
    const tax = computeGst({
      basePaise: plan.priceInr * 100,
      sellerStateCode,
      buyerStateCode: stateCode,
    });
    return tax;
  }

  async function choose(planId: string) {
    setError("");
    if (!/^[6-9]\d{9}$/.test(phone)) return setError("Enter a valid 10-digit mobile number first.");
    if (legalName.trim().length < 2) return setError("Enter the billing name.");
    if (address.trim().length < 5) return setError("Enter the billing address.");
    if (!stateCode) return setError("Choose the customer's state.");
    setPendingPlan(planId);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, phone, legalName, address, stateCode, gstin: gstin || undefined }),
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
    <div className="mx-auto h-full min-h-0 max-w-5xl flex-1 space-y-6 overflow-y-auto p-8">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">Plan</p>
        <Link href="/dashboard" className="text-sm font-semibold text-[var(--muted)] underline">Back to dashboard</Link>
      </div>
      <div>
        <h1 className="mt-2 text-2xl font-bold">{welcome ? "Welcome. Choose your plan" : "Choose your plan"}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Prices exclude GST. GST is added at checkout and shown before you pay. You can skip this step and come back later from the menu.
        </p>
      </div>

      {!canPay && (
        <p className="rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--muted)]">
          Only the workspace owner or an admin can choose a plan. Ask them to complete checkout.
        </p>
      )}
      {canPay && !sellerReady && (
        <p className="rounded-lg border border-amber-400 p-4 text-sm text-amber-200">
          Payments are not available yet. Our team will contact you to complete setup.
        </p>
      )}

      {canPay && sellerReady && (
        <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-2">
          <h2 className="md:col-span-2 font-semibold">Billing details for your GST invoice</h2>
          <label className="text-sm">
            <span className="mb-1 block font-semibold">Billing name (as on GST registration)</span>
            <input value={legalName} onChange={(e) => setLegalName(e.target.value)} maxLength={200}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold">GSTIN (optional, for business buyers)</span>
            <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} maxLength={15} placeholder="15 characters"
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 uppercase" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold">State of supply</span>
            <select value={stateCode} onChange={(e) => setStateCode(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <option value="">Choose a state</option>
              {Object.entries(GST_STATE_CODES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold">Mobile number for the payment</span>
            <input inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="10-digit mobile" className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block font-semibold">Billing address</span>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" />
          </label>
          {gstin && stateCode && gstin.slice(0, 2) !== stateCode && (
            <p className="md:col-span-2 text-sm text-red-300">The state must match the first two digits of the GSTIN.</p>
          )}
        </section>
      )}

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {billingPlans.map((plan) => {
          const tax = preview(plan);
          return (
            <article key={plan.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="text-xs uppercase tracking-wider text-[var(--muted)]">{plan.term} · {plan.days}</p>
              <h2 className="mt-1 font-semibold">{plan.name}</h2>
              <p className="mt-2 text-2xl font-bold">₹{plan.priceInr.toLocaleString("en-IN")}<span className="text-sm font-normal text-[var(--muted)]"> / {plan.period} + GST</span></p>
              {tax && (
                <dl className="mt-3 space-y-1 text-sm text-[var(--muted)]">
                  <div className="flex justify-between"><dt>Base</dt><dd>{inr(tax.baseInrPaise)}</dd></div>
                  {tax.rateSplit === "intra_state" ? (
                    <>
                      <div className="flex justify-between"><dt>CGST 9%</dt><dd>{inr(tax.cgstPaise)}</dd></div>
                      <div className="flex justify-between"><dt>SGST 9%</dt><dd>{inr(tax.sgstPaise)}</dd></div>
                    </>
                  ) : (
                    <div className="flex justify-between"><dt>IGST 18%</dt><dd>{inr(tax.igstPaise)}</dd></div>
                  )}
                  <div className="flex justify-between font-semibold text-[var(--foreground)]"><dt>Total</dt><dd>{inr(tax.totalInrPaise)}</dd></div>
                </dl>
              )}
              <button
                type="button"
                disabled={!canPay || !sellerReady || pendingPlan !== null}
                onClick={() => choose(plan.id)}
                className="mt-4 rounded-lg bg-whatsapp px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                {pendingPlan === plan.id ? "Opening payment…" : "Choose and pay"}
              </button>
            </article>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Link href="/dashboard" className="inline-block text-sm text-[var(--muted)] underline">Skip for now</Link>
        <Link href="/inbox" className="inline-block text-sm text-[var(--muted)] underline">Go to inbox</Link>
      </div>
    </div>
  );
}

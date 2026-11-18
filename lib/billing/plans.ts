// Plan catalogue shared by the public pricing page and checkout.
// Prices are INR, excluding GST, as shown on /pricing. Checkout charges these amounts.

export type PlanPeriod = "year" | "month";

export interface BillingPlan {
  id: string;
  term: "Yearly" | "Monthly";
  days: "365 Days" | "30 Days";
  name: string;
  priceInr: number;
  period: PlanPeriod;
  description: string;
  popular?: boolean;
  features: string[];
}

// Shown on every plan: the CRM offer described on /crm.
export const crmOfferFeature = "CRM of your choice: Coldcall.in free (1 user + 1 web admin) or a SuperCRM free trial";

export const billingPlans: BillingPlan[] = [
  {
    id: "sales-accelerator",
    term: "Yearly",
    days: "365 Days",
    name: "Sales Accelerator – WhatsApp + CRM – Yearly",
    priceInr: 20000,
    period: "year",
    description:
      "The complete solution for scaling your business. This plan includes your choice of CRM, Coldcall.in or SuperCRM, with advanced automation and deeper insights to close more deals.",
    popular: true,
    features: ["Official WhatsApp Cloud API Integration", "Multi-Agent Shared Team Inbox", crmOfferFeature],
  },
  {
    id: "lead-automation-suite",
    term: "Yearly",
    days: "365 Days",
    name: "Always-On Lead Automation Suite – Yearly",
    priceInr: 12500,
    period: "year",
    description: "Everything you need to get started with your business on WhatsApp.",
    features: ["Official WhatsApp Cloud API Integration", "Multi-Agent Shared Team Inbox", crmOfferFeature],
  },
  {
    id: "whats-crm-monthly",
    term: "Monthly",
    days: "30 Days",
    name: "Whats+CRM Monthly",
    priceInr: 2000,
    period: "month",
    description: "WhatsApp and your choice of CRM, Coldcall.in or SuperCRM, billed monthly.",
    features: ["Official WhatsApp Cloud API Integration", "Multi-Agent Shared Team Inbox", crmOfferFeature],
  },
  {
    id: "growth-booster",
    term: "Monthly",
    days: "30 Days",
    name: "Growth Booster – WhatsApp Automation – Monthly",
    priceInr: 1250,
    period: "month",
    description:
      "A comprehensive monthly solution for your business. Manage customers, track payments, and boost engagement on one platform built to accelerate your growth.",
    features: ["Official WhatsApp Cloud API Integration", "Multi-Agent Shared Team Inbox", crmOfferFeature],
  },
];

export function findBillingPlan(planId: unknown): BillingPlan | undefined {
  if (typeof planId !== "string") return undefined;
  return billingPlans.find((plan) => plan.id === planId);
}

export function planAmountPaise(plan: BillingPlan): number {
  return plan.priceInr * 100;
}

export function planPeriodEnd(plan: BillingPlan, start: Date): Date {
  const end = new Date(start);
  if (plan.period === "year") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCDate(end.getUTCDate() + 30);
  return end;
}

// Indian mobile numbers: 10 digits starting 6-9. Cashfree requires a customer phone.
export function isValidIndianMobile(value: unknown): value is string {
  return typeof value === "string" && /^[6-9]\d{9}$/.test(value);
}

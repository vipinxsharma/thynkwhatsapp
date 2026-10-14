import { CapabilitySection } from "@/components/product/CapabilitySection";
import { DltReadinessForm } from "@/components/sms/DltReadinessForm";
import { requirePageSession } from "@/lib/auth/session";

const steps = [
  "Choose a DLT access-provider portal and register the sending legal entity as a Principal Entity (PE).",
  "Register and obtain approval for sender headers and content templates; record their IDs for each workspace.",
  "Where required, register consent templates and retain evidence of customer consent and preferences.",
  "Select an authorized delivery partner/route separately from the DLT registrar; map PE, header and template IDs to that route.",
  "Allow sending only after approval and route verification, then reconcile delivery receipts, failures, opt-outs and usage.",
];

export default async function SmsGatewayPage() {
  const session = await requirePageSession();
  return (
    <CapabilitySection
      eyebrow="Phase 2 · India"
      title="SMS gateway & DLT"
      description="A planned second channel for transactional, service and permitted promotional SMS, with DLT compliance built into onboarding."
      notice="SMS sending is not available. Draft details saved here are not submitted to or verified by a DLT access provider."
      capabilities={[
        {
          title: "DLT onboarding",
          description: "Track PE registration, header and content-template approval, consent requirements and evidence by legal entity.",
          status: "Phase 2",
        },
        {
          title: "Operator and route selection",
          description: "Distinguish the DLT registration access provider from the delivery telemarketer/aggregator. Compare API capability, reliability, support and commercial terms before activating a route.",
          status: "Phase 2",
        },
        {
          title: "SMS templates and campaigns",
          description: "Validate rendered text against approved DLT templates, consent and category before queueing; reject unapproved content.",
          status: "Phase 2",
        },
        {
          title: "Receipts and controls",
          description: "Use idempotent sends, rate limits, delivery receipts, opt-outs, audit trails and per-workspace billing reconciliation.",
          status: "Phase 2",
        },
      ]}
    >
      <DltReadinessForm canEdit={session.role === "owner" || session.role === "admin"} />
      <section className="space-y-4 border-t border-[var(--border)] pt-6">
        <h2 className="text-xl font-semibold text-[var(--heading)]">Planned self-serve sequence</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-[var(--muted)]">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="text-xs leading-5 text-[var(--muted)]">
          Regulatory reference: {" "}
          <a className="text-whatsapp-dark underline" href="https://www.trai.gov.in/advice-to-senders" target="_blank" rel="noreferrer">
            TRAI advice to senders
          </a>. DLT registration and approval happen with an access provider, not inside Xeccel.
        </p>
      </section>
    </CapabilitySection>
  );
}

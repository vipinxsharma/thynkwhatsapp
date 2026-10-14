import { CapabilitySection } from "@/components/product/CapabilitySection";

export default function AIAgentsPage() {
  return (
    <CapabilitySection
      eyebrow="Xeccel intelligence"
      title="AI agents"
      description="A home for customer-facing conversational agents, separate from the existing AI support assistant."
      notice="Customer-facing agents are not active. The available AI foundation only reviews authenticated support cases; it does not answer WhatsApp conversations automatically."
      capabilities={[
        {
          title: "Support case review",
          description: "Tenant-scoped, evidence-grounded AI guidance with escalation for billing, security, ownership and account restrictions.",
          status: "Available foundation",
          href: "/support",
          linkLabel: "Open support",
        },
        {
          title: "WhatsApp conversation agent",
          description: "Planned: workspace knowledge, approved intents, confidence gates, human handoff and auditable replies before any automated customer message.",
          status: "Planned",
        },
        {
          title: "Agent workspace",
          description: "Planned: versioned instructions and knowledge, test conversations, channel assignment, safety rules and performance review.",
          status: "Planned",
        },
        {
          title: "Cross-channel agents",
          description: "Web and voice agents are future extensions; they do not inherit WhatsApp permissions or customer data by default.",
          status: "Planned",
        },
      ]}
    />
  );
}

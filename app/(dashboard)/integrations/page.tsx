import { CapabilitySection } from "@/components/product/CapabilitySection";

export default function IntegrationsPage() {
  return (
    <CapabilitySection
      eyebrow="Connect Xeccel"
      title="Integrations & developer tools"
      description="One place for channel connections, application APIs, webhooks and external systems."
      notice="There is no customer API-key or webhook-management console yet. Existing server endpoints are internal application interfaces, not a published partner API."
      capabilities={[
        {
          title: "WhatsApp channel",
          description: "Connect a WABA and inspect the ownership record and stored subscription status. Live delivery still needs Meta acceptance and webhook proof.",
          status: "Available foundation",
          href: "/settings/waba",
          linkLabel: "Open channel settings",
        },
        {
          title: "Developer API",
          description: "Planned: tenant-scoped credentials, documented endpoints, scoped permissions, rate limits, rotation and audit logs.",
          status: "Planned",
        },
        {
          title: "Customer webhooks",
          description: "Planned: event subscriptions, signing secrets, delivery attempts, retries, replay and per-workspace observability.",
          status: "Planned",
        },
        {
          title: "CRM and commerce connectors",
          description: "Planned: explicit, opt-in integrations with field mapping and sync health rather than copying contact data automatically.",
          status: "Planned",
        },
      ]}
    />
  );
}

import { CapabilitySection } from "@/components/product/CapabilitySection";

export default function GrowthPage() {
  return (
    <CapabilitySection
      eyebrow="Commerce and acquisition"
      title="Growth channels"
      description="Catalog, shopping and click-to-WhatsApp acquisition are distinct from core messaging and require their own connections and measurement."
      notice="Commerce and ads are roadmap sections, not connected services. No catalog, ad account, checkout or revenue attribution is active in this workspace."
      capabilities={[
        {
          title: "WhatsApp catalog",
          description: "Planned: customer-owned catalog connection, product sync, catalog message eligibility and order-event handling.",
          status: "Planned",
        },
        {
          title: "Checkout and payments",
          description: "Planned: order-to-payment lifecycle with a supported provider and verified payment events. This is separate from Xeccel subscription billing.",
          status: "Planned",
        },
        {
          title: "Click-to-WhatsApp ads",
          description: "Planned: opt-in ad account connection, lead source capture and campaign attribution without implying ad delivery or spend control.",
          status: "Planned",
        },
        {
          title: "Revenue reporting",
          description: "Planned: reconcile attributed conversations, orders and verified payments before reporting return on ad spend.",
          status: "Planned",
        },
      ]}
    />
  );
}

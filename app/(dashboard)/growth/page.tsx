import { CapabilitySection } from "@/components/product/CapabilitySection";

export default function GrowthPage() {
  return (
    <CapabilitySection
      eyebrow="Commerce and acquisition"
      title="Growth channels"
      description="Catalog, shopping and click-to-WhatsApp acquisition are distinct from core messaging and require their own connections and measurement."
      notice="Commerce and ads are roadmap sections, not connected services. No catalog, checkout or revenue attribution is active in this workspace. No ad account is connected unless a workspace owner or admin completes the read-only connection."
      capabilities={[
        {
          title: "WhatsApp catalog",
          description: "Planned: customer-owned catalog connection, product sync, catalog message eligibility and order-event handling.",
          status: "Planned",
        },
        {
          title: "Checkout and payments",
          description: "Orders raised from a conversation, Cashfree payment links, and paid status set only from a verified Cashfree payment. Separate from Xeccel subscription billing.",
          status: "Available foundation",
        },
        {
          title: "Click-to-WhatsApp ads",
          description: "Ad referrals from inbound messages are recorded per contact. An opt-in ad account connection requests read-only access (ads_read). Thynk never creates ads, changes budgets or changes delivery. Real users can connect only after Meta approves ads_read.",
          status: "Available foundation",
          href: "/growth/ads/connect",
          linkLabel: "Review and connect",
        },
        {
          title: "Revenue reporting",
          description: "Reconciles click-to-WhatsApp referrals, checkout orders and verified payments per source. Only verified payments count as revenue. Ad spend is not synced, so return on ad spend is not shown.",
          status: "Available foundation",
          href: "/growth/revenue",
          linkLabel: "View revenue report",
        },
      ]}
    />
  );
}

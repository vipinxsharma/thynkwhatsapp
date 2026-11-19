import { requirePageSession } from "@/lib/auth/session";
import { BillingPlanPicker } from "@/components/billing/BillingPlanPicker";
import { sellerTaxConfig } from "@/lib/billing/seller";

export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const session = await requirePageSession();
  const { welcome } = await searchParams;
  const seller = sellerTaxConfig();
  return (
    <BillingPlanPicker
      canPay={session.role === "owner" || session.role === "admin"}
      welcome={welcome === "1"}
      sellerReady={Boolean(seller)}
      sellerStateCode={seller?.stateCode ?? null}
    />
  );
}

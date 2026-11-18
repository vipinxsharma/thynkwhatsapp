import { requirePageSession } from "@/lib/auth/session";
import { ReturnStatus } from "./ReturnStatus";

export const dynamic = "force-dynamic";

export default async function BillingReturnPage() {
  await requirePageSession();
  return <ReturnStatus />;
}

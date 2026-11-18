import { requirePageSession } from "@/lib/auth/session";
import { CrmChoicePicker } from "@/components/crm/CrmChoicePicker";
import { crmOptions } from "@/lib/crm/options";
import { getCrmChoice, type CrmChoice } from "@/lib/crm/store";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const session = await requirePageSession();
  let choice: CrmChoice | null = null;
  let unavailable = false;
  try {
    choice = await getCrmChoice(session.tenantId);
  } catch {
    unavailable = true;
  }
  return (
    <CrmChoicePicker
      options={crmOptions}
      initialChoice={choice}
      canChoose={session.role === "owner" || session.role === "admin"}
      unavailable={unavailable}
    />
  );
}

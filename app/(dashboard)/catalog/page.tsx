import { requirePageSession } from "@/lib/auth/session";
import { listCatalogProducts } from "@/lib/catalog/products";
import { CatalogManager } from "./CatalogManager";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const session = await requirePageSession();
  const products = await listCatalogProducts(session.tenantId, { limit: 200 });
  const canWrite = session.role === "owner" || session.role === "admin";

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6">
      <div className="pb-6 border-b border-white/5">
        <h1 className="text-2xl font-bold text-white tracking-tight">Product catalogue</h1>
        <p className="text-sm text-gray-400 mt-1">
          Products you sell. Active products can be shared with the AI helper when it answers customers.
        </p>
      </div>
      <CatalogManager initialProducts={products} canWrite={canWrite} />
    </div>
  );
}

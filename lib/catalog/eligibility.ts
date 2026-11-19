import { getCatalogProduct } from "@/lib/catalog/products";
import { getCatalogLink, listCatalogSyncItems, type CatalogLink, type CatalogSyncItemRecord } from "@/lib/meta/catalog-store";
import { toMetaItem, type CatalogProductForSync } from "@/lib/meta/catalog-sync";

/**
 * A product message may be sent only when the workspace catalogue is linked to the WABA, and the
 * product is active, in stock, and already synced to Meta with its current data.
 */

export type ProductEligibilityReason =
  | "catalog_not_linked"
  | "product_not_found"
  | "product_inactive"
  | "product_out_of_stock"
  | "product_missing_image"
  | "product_invalid_price"
  | "product_not_synced";

export interface EligibleProduct {
  eligible: true;
  catalogId: string;
  /** WABA the catalogue is linked to. The sender's WABA must match before any send. */
  linkedWabaId: string | null;
  retailerId: string;
  productName: string;
}

export interface IneligibleProduct {
  eligible: false;
  reason: ProductEligibilityReason;
  message: string;
}

export type ProductEligibility = EligibleProduct | IneligibleProduct;

const MESSAGES: Record<ProductEligibilityReason, string> = {
  catalog_not_linked: "The catalogue is not linked to WhatsApp yet. Connect it and finish a sync first.",
  product_not_found: "This product is not in the workspace catalogue.",
  product_inactive: "This product is disabled. Enable it before sending it.",
  product_out_of_stock: "This product is out of stock.",
  product_missing_image: "This product needs an image before it can be sent in a catalogue message.",
  product_invalid_price: "This product has an invalid price.",
  product_not_synced: "This product has changed since its last sync. Run a catalogue sync first.",
};

function ineligible(reason: ProductEligibilityReason): IneligibleProduct {
  return { eligible: false, reason, message: MESSAGES[reason] };
}

/** Pure rule check. Makes no I/O, so every branch can be tested directly. */
export function evaluateProductEligibility(input: {
  link: CatalogLink | null;
  product: CatalogProductForSync | null;
  syncItem: CatalogSyncItemRecord | null;
}): ProductEligibility {
  const { link, product, syncItem } = input;
  if (!link || !link.metaCatalogId || link.status !== "linked") return ineligible("catalog_not_linked");
  if (!product) return ineligible("product_not_found");
  if (!product.active) return ineligible("product_inactive");
  if (!product.inStock) return ineligible("product_out_of_stock");

  const prepared = toMetaItem(product);
  if ("skipped" in prepared) {
    return ineligible(prepared.skipped === "missing image" ? "product_missing_image" : "product_invalid_price");
  }
  // Only the hash of what Meta last received counts, so an edit made after the last sync blocks sending.
  if (!syncItem || syncItem.status !== "synced" || syncItem.lastHash !== prepared.hash) {
    return ineligible("product_not_synced");
  }

  return {
    eligible: true,
    catalogId: link.metaCatalogId,
    linkedWabaId: link.wabaId,
    retailerId: prepared.retailerId,
    productName: product.name,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Loads the link, product and sync record for one workspace product, then applies the rules. */
export async function checkProductMessageEligibility(workspaceId: string, productId: string): Promise<ProductEligibility> {
  if (!UUID.test(productId)) return ineligible("product_not_found");
  const link = await getCatalogLink(workspaceId);
  if (!link?.metaCatalogId || link.status !== "linked") return ineligible("catalog_not_linked");
  const product = await getCatalogProduct(workspaceId, productId);
  const syncItems = await listCatalogSyncItems(workspaceId);
  const syncItem = syncItems.find((item) => item.productId === productId) ?? null;
  return evaluateProductEligibility({ link, product, syncItem });
}

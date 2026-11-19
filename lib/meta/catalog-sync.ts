import crypto from "node:crypto";
import { getMetaConnectionForWorkspace } from "@/lib/meta/connections";
import { MetaCatalogClient, type CatalogItemRequest, type CatalogItemData } from "@/lib/meta/catalog";
import {
  getCatalogLink,
  listCatalogProductsForSync,
  listCatalogSyncItems,
  recordCatalogSyncItems,
  upsertCatalogLink,
  type CatalogLink,
  type CatalogSyncItemRecord,
} from "@/lib/meta/catalog-store";

/** Product shape from the product catalogue (app_catalog_products). Defined here so sync does not depend on that branch. */
export interface CatalogProductForSync {
  id: string;
  name: string;
  description: string | null;
  priceInr: number | string;
  currency: "INR";
  imageUrl: string | null;
  sku: string | null;
  inStock: boolean;
  active: boolean;
  updatedAt: string | Date;
}

/** Meta's documented batch limit for this sync is 500 items per request. */
export const META_BATCH_LIMIT = 500;

export type SkipReason = "missing image" | "invalid price";

export interface PreparedItem {
  productId: string;
  retailerId: string;
  data: CatalogItemData;
  hash: string;
}

export interface SkippedItem {
  productId: string;
  reason: SkipReason;
}

export function catalogLiveEnabled(): boolean {
  return process.env.META_CATALOG_LIVE === "true";
}

/** Meta price string: "<amount> INR", two decimals. Returns null for values that cannot be a price. */
export function formatPrice(priceInr: number | string): string | null {
  const amount = typeof priceInr === "number" ? priceInr : Number(String(priceInr).trim());
  if (!Number.isFinite(amount) || amount < 0) return null;
  return `${amount.toFixed(2)} INR`;
}

/** Inactive products are sent as out of stock, never deleted. */
export function availabilityFor(product: Pick<CatalogProductForSync, "active" | "inStock">): "in stock" | "out of stock" {
  return product.active && product.inStock ? "in stock" : "out of stock";
}

/** Retailer ID is the product's own ID, so renaming a SKU never orphans its Meta item. */
export function retailerIdFor(product: Pick<CatalogProductForSync, "id">): string {
  return product.id;
}

/** Turns one product into the Meta item data. Returns a skip reason instead when Meta cannot accept it. */
export function toMetaItem(product: CatalogProductForSync): PreparedItem | { skipped: SkipReason } {
  const price = formatPrice(product.priceInr);
  if (!price) return { skipped: "invalid price" };
  const image = product.imageUrl?.trim();
  if (!image) return { skipped: "missing image" };
  const data: CatalogItemData = {
    name: product.name.trim().slice(0, 150),
    description: (product.description ?? product.name).trim().slice(0, 5000),
    price,
    currency: "INR",
    availability: availabilityFor(product),
    image_link: image,
  };
  const retailerId = retailerIdFor(product);
  return { productId: product.id, retailerId, data, hash: hashItem(retailerId, data) };
}

/** Stable hash over exactly what Meta would receive. Unchanged data means an unchanged hash. */
export function hashItem(retailerId: string, data: CatalogItemData): string {
  const canonical = JSON.stringify({ retailerId, data: sortKeys(data) });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function sortKeys(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export interface SyncPlan {
  toCreate: PreparedItem[];
  toUpdate: PreparedItem[];
  unchanged: PreparedItem[];
  skipped: SkippedItem[];
}

/** Compares prepared items with the last-sent hashes. Pure: no I/O. */
export function planItems(
  products: CatalogProductForSync[],
  lastSent: Map<string, string | null>
): SyncPlan {
  const plan: SyncPlan = { toCreate: [], toUpdate: [], unchanged: [], skipped: [] };
  for (const product of products) {
    const prepared = toMetaItem(product);
    if ("skipped" in prepared) {
      plan.skipped.push({ productId: product.id, reason: prepared.skipped });
      continue;
    }
    if (!lastSent.has(prepared.productId)) plan.toCreate.push(prepared);
    else if (lastSent.get(prepared.productId) !== prepared.hash) plan.toUpdate.push(prepared);
    else plan.unchanged.push(prepared);
  }
  return plan;
}

/** Splits items into batches of at most `size` (default META_BATCH_LIMIT). */
export function chunkItems<T>(items: T[], size: number = META_BATCH_LIMIT): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error("Batch size must be a positive integer");
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

export interface WorkspaceCatalogPlan {
  mode: "dry-run" | "live";
  link: CatalogLink | null;
  catalogExists: boolean;
  willCreateCatalog: boolean;
  counts: { create: number; update: number; unchanged: number; skipped: number };
  skipped: SkippedItem[];
  liveEnabled: boolean;
}

/**
 * Reads the link and products and works out what a sync would do. Makes no Meta calls.
 */
export async function planWorkspaceCatalog(workspaceId: string): Promise<WorkspaceCatalogPlan> {
  const link = await getCatalogLink(workspaceId);
  const products = await listCatalogProductsForSync(workspaceId);
  const syncItems = await listCatalogSyncItems(workspaceId);
  const lastSent = new Map(syncItems.map((item) => [item.productId, item.lastHash]));
  const plan = planItems(products, lastSent);
  return {
    mode: "dry-run",
    link,
    catalogExists: Boolean(link?.metaCatalogId),
    willCreateCatalog: !link?.metaCatalogId,
    counts: {
      create: plan.toCreate.length,
      update: plan.toUpdate.length,
      unchanged: plan.unchanged.length,
      skipped: plan.skipped.length,
    },
    skipped: plan.skipped,
    liveEnabled: catalogLiveEnabled(),
  };
}

export interface SyncResult {
  mode: "dry-run" | "live";
  plan: WorkspaceCatalogPlan;
  sent: number;
  failed: number;
  batches: number;
  catalogCreated: boolean;
  error: string | null;
}

const CATALOG_NAME = "Xeccel catalog";

/**
 * Syncs the workspace catalogue to Meta. Without META_CATALOG_LIVE=true this returns the dry-run
 * plan and makes no Meta write calls. Live: creates and links the catalog only when no link exists,
 * sends only changed items in batches of at most 500, records per-item status, never deletes.
 */
export async function syncWorkspaceCatalog(workspaceId: string): Promise<SyncResult> {
  const plan = await planWorkspaceCatalog(workspaceId);
  if (!catalogLiveEnabled()) {
    return { mode: "dry-run", plan, sent: 0, failed: 0, batches: 0, catalogCreated: false, error: null };
  }

  const connection = await getMetaConnectionForWorkspace(workspaceId);
  const client = new MetaCatalogClient(connection.accessToken);
  let catalogId = plan.link?.metaCatalogId ?? null;
  let catalogCreated = false;

  try {
    if (!catalogId) {
      const businessId = await client.readClientBusinessId();
      const catalog = await client.createCommerceCatalog(businessId, CATALOG_NAME);
      catalogId = catalog.id;
      catalogCreated = true;
      // Save the catalog ID before linking, so a failed link never orphans the created catalog.
      await upsertCatalogLink({ workspaceId, metaCatalogId: catalogId, wabaId: connection.wabaId, status: "pending" });
    }
    if (!plan.link || plan.link.status !== "linked") {
      await client.connectCatalogToWaba(connection.wabaId, catalogId);
      await upsertCatalogLink({ workspaceId, metaCatalogId: catalogId, wabaId: connection.wabaId, status: "linked", lastError: null });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog setup failed";
    await upsertCatalogLink({ workspaceId, metaCatalogId: catalogId, wabaId: connection.wabaId, status: "error", lastError: message });
    return { mode: "live", plan, sent: 0, failed: 0, batches: 0, catalogCreated, error: message };
  }

  const products = await listCatalogProductsForSync(workspaceId);
  const syncItems = await listCatalogSyncItems(workspaceId);
  const lastSent = new Map(syncItems.map((item) => [item.productId, item.lastHash]));
  const itemPlan = planItems(products, lastSent);
  const toSend = [...itemPlan.toCreate, ...itemPlan.toUpdate];
  const now = new Date().toISOString();
  const records: CatalogSyncItemRecord[] = itemPlan.skipped.map((skip) => ({
    productId: skip.productId,
    metaRetailerId: skip.productId,
    lastHash: null,
    lastSyncedAt: null,
    status: "skipped",
    error: skip.reason,
  }));

  let sent = 0;
  let failed = 0;
  let batches = 0;
  let firstError: string | null = null;
  for (const batch of chunkItems(toSend, META_BATCH_LIMIT)) {
    batches += 1;
    const requests: CatalogItemRequest[] = batch.map((item) => ({ method: "UPDATE", retailer_id: item.retailerId, data: item.data }));
    try {
      await client.sendItemsBatch(catalogId!, requests);
      sent += batch.length;
      for (const item of batch) {
        records.push({ productId: item.productId, metaRetailerId: item.retailerId, lastHash: item.hash, lastSyncedAt: now, status: "synced", error: null });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Batch failed";
      firstError ??= message;
      failed += batch.length;
      for (const item of batch) {
        records.push({ productId: item.productId, metaRetailerId: item.retailerId, lastHash: null, lastSyncedAt: null, status: "error", error: message.slice(0, 500) });
      }
    }
  }

  await recordCatalogSyncItems(workspaceId, records);
  await upsertCatalogLink({
    workspaceId,
    metaCatalogId: catalogId,
    wabaId: connection.wabaId,
    status: failed > 0 ? "error" : "linked",
    lastError: firstError,
    lastSyncedAt: new Date(),
  });
  return { mode: "live", plan, sent, failed, batches, catalogCreated, error: firstError };
}

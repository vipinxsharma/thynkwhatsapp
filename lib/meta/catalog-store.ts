import { neon } from "@neondatabase/serverless";
import type { CatalogProductForSync } from "@/lib/meta/catalog-sync";

/**
 * Database access for the Meta catalog sync. Tables: app_meta_catalog_links (one per workspace)
 * and app_meta_catalog_sync_items (one per product). Migration 0026.
 */

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

export type CatalogLinkStatus = "pending" | "linked" | "error";
export type CatalogItemStatus = "pending" | "synced" | "skipped" | "error";

export interface CatalogLink {
  workspaceId: string;
  metaCatalogId: string | null;
  wabaId: string | null;
  status: CatalogLinkStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface CatalogSyncItemRecord {
  productId: string;
  metaRetailerId: string;
  lastHash: string | null;
  lastSyncedAt: string | null;
  status: CatalogItemStatus;
  error: string | null;
}

const linkColumns = `workspace_id AS "workspaceId", meta_catalog_id AS "metaCatalogId", waba_id AS "wabaId",
  status, last_synced_at AS "lastSyncedAt", last_error AS "lastError"`;

export async function getCatalogLink(workspaceId: string): Promise<CatalogLink | null> {
  const rows = await database().query(
    `SELECT ${linkColumns} FROM app_meta_catalog_links WHERE workspace_id = $1::uuid`,
    [workspaceId]
  );
  return (rows[0] as CatalogLink | undefined) ?? null;
}

export async function upsertCatalogLink(input: {
  workspaceId: string;
  metaCatalogId?: string | null;
  wabaId?: string | null;
  status: CatalogLinkStatus;
  lastError?: string | null;
  lastSyncedAt?: Date | null;
}): Promise<void> {
  await database().query(
    `INSERT INTO app_meta_catalog_links (workspace_id, meta_catalog_id, waba_id, status, last_error, last_synced_at)
     VALUES ($1::uuid, $2, $3, $4, $5, $6::timestamptz)
     ON CONFLICT (workspace_id) DO UPDATE SET
       meta_catalog_id = COALESCE(EXCLUDED.meta_catalog_id, app_meta_catalog_links.meta_catalog_id),
       waba_id = COALESCE(EXCLUDED.waba_id, app_meta_catalog_links.waba_id),
       status = EXCLUDED.status,
       last_error = EXCLUDED.last_error,
       last_synced_at = COALESCE(EXCLUDED.last_synced_at, app_meta_catalog_links.last_synced_at),
       updated_at = now()`,
    [
      input.workspaceId,
      input.metaCatalogId ?? null,
      input.wabaId ?? null,
      input.status,
      input.lastError ? input.lastError.slice(0, 500) : null,
      input.lastSyncedAt ? input.lastSyncedAt.toISOString() : null,
    ]
  );
}

export async function listCatalogSyncItems(workspaceId: string): Promise<CatalogSyncItemRecord[]> {
  const rows = await database().query(
    `SELECT product_id AS "productId", meta_retailer_id AS "metaRetailerId", last_hash AS "lastHash",
       last_synced_at AS "lastSyncedAt", status, error
     FROM app_meta_catalog_sync_items WHERE workspace_id = $1::uuid`,
    [workspaceId]
  );
  return rows as unknown as CatalogSyncItemRecord[];
}

/** Writes per-item results in one statement. Never removes rows. */
export async function recordCatalogSyncItems(workspaceId: string, items: CatalogSyncItemRecord[]): Promise<void> {
  if (items.length === 0) return;
  await database().query(
    `INSERT INTO app_meta_catalog_sync_items
       (workspace_id, product_id, meta_retailer_id, last_hash, last_synced_at, status, error)
     SELECT $1::uuid, t.product_id, t.meta_retailer_id, t.last_hash, t.last_synced_at::timestamptz, t.status, t.error
     FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[])
       AS t(product_id, meta_retailer_id, last_hash, last_synced_at, status, error)
     ON CONFLICT (workspace_id, product_id) DO UPDATE SET
       meta_retailer_id = EXCLUDED.meta_retailer_id,
       last_hash = COALESCE(EXCLUDED.last_hash, app_meta_catalog_sync_items.last_hash),
       last_synced_at = COALESCE(EXCLUDED.last_synced_at, app_meta_catalog_sync_items.last_synced_at),
       status = EXCLUDED.status,
       error = EXCLUDED.error`,
    [
      workspaceId,
      items.map((item) => item.productId),
      items.map((item) => item.metaRetailerId),
      items.map((item) => item.lastHash ?? null),
      items.map((item) => item.lastSyncedAt ?? null),
      items.map((item) => item.status),
      items.map((item) => item.error ?? null),
    ]
  );
}

/**
 * Reads the workspace's products from app_catalog_products (owned by the product catalogue work).
 * Returns an empty list when that table does not exist yet, so sync can ship before it.
 * Column names are the agreed product shape; adjust here if the product table differs.
 */
export async function listCatalogProductsForSync(workspaceId: string): Promise<CatalogProductForSync[]> {
  const db = database();
  const exists = await db.query(`SELECT to_regclass('app_catalog_products') IS NOT NULL AS present`);
  if (!(exists[0] as { present?: boolean } | undefined)?.present) return [];
  const rows = await db.query(
    `SELECT id::text AS id, name, description, price_inr AS "priceInr", currency,
       image_url AS "imageUrl", sku, in_stock AS "inStock", active, updated_at AS "updatedAt"
     FROM app_catalog_products WHERE workspace_id = $1::uuid ORDER BY name, id`,
    [workspaceId]
  );
  return rows as unknown as CatalogProductForSync[];
}

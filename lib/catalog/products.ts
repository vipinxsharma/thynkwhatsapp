import { neon } from "@neondatabase/serverless";
import type { CatalogProduct, CatalogProductInput, CatalogProductListFilter } from "@/lib/catalog/types";

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

const columns = `id, name, description, price_inr AS "priceInr", currency, image_url AS "imageUrl", sku,
  in_stock AS "inStock", active, updated_at AS "updatedAt"`;

type ProductRow = Omit<CatalogProduct, "priceInr" | "updatedAt" | "currency"> & {
  priceInr: string | number;
  updatedAt: string | Date;
};

function toProduct(row: unknown): CatalogProduct | null {
  if (!row) return null;
  const value = row as ProductRow;
  return {
    id: value.id,
    name: value.name,
    description: value.description ?? "",
    priceInr: Number(value.priceInr),
    currency: "INR",
    imageUrl: value.imageUrl ?? null,
    sku: value.sku ?? null,
    inStock: Boolean(value.inStock),
    active: Boolean(value.active),
    updatedAt: new Date(value.updatedAt).toISOString(),
  };
}

function toProducts(rows: unknown[]): CatalogProduct[] {
  return rows.map(toProduct).filter((product): product is CatalogProduct => product !== null);
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

function clampLimit(value: number | undefined, fallback: number): number {
  const number = Math.trunc(value ?? fallback);
  return Math.min(Math.max(number, 1), MAX_LIMIT);
}

/** Lists the workspace's products, most recently updated first. Search matches name or SKU. */
export async function listCatalogProducts(
  workspaceId: string,
  filter: CatalogProductListFilter = {}
): Promise<CatalogProduct[]> {
  const params: unknown[] = [workspaceId];
  const where = ["workspace_id = $1::uuid"];
  const search = filter.search?.trim();
  if (search) {
    const escaped = search.replace(/[\\%_]/g, (char) => `\\${char}`);
    params.push(`%${escaped}%`);
    where.push(`(name ILIKE $${params.length} OR sku ILIKE $${params.length})`);
  }
  if (typeof filter.active === "boolean") {
    params.push(filter.active);
    where.push(`active = $${params.length}`);
  }
  if (typeof filter.inStock === "boolean") {
    params.push(filter.inStock);
    where.push(`in_stock = $${params.length}`);
  }
  const limit = clampLimit(filter.limit, DEFAULT_LIMIT);
  const offset = Math.max(Math.trunc(filter.offset ?? 0), 0);
  params.push(limit, offset);
  const rows = await database().query(
    `SELECT ${columns} FROM app_catalog_products
     WHERE ${where.join(" AND ")}
     ORDER BY updated_at DESC, id
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return toProducts(rows);
}

export async function getCatalogProduct(workspaceId: string, productId: string): Promise<CatalogProduct | null> {
  const rows = await database().query(
    `SELECT ${columns} FROM app_catalog_products WHERE workspace_id = $1::uuid AND id = $2::uuid`,
    [workspaceId, productId]
  );
  return toProduct(rows[0]);
}

export async function createCatalogProduct(
  workspaceId: string,
  input: CatalogProductInput
): Promise<CatalogProduct> {
  const rows = await database().query(
    `INSERT INTO app_catalog_products
       (workspace_id, name, description, price_inr, image_url, sku, in_stock, active)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${columns}`,
    [workspaceId, input.name, input.description, input.priceInr, input.imageUrl, input.sku, input.inStock, input.active]
  );
  const created = toProduct(rows[0]);
  if (!created) throw new Error("Product could not be created");
  return created;
}

/** Replaces the editable fields of a product. Returns null when it is not in this workspace. */
export async function updateCatalogProduct(
  workspaceId: string,
  productId: string,
  input: CatalogProductInput
): Promise<CatalogProduct | null> {
  const rows = await database().query(
    `UPDATE app_catalog_products SET
       name = $3, description = $4, price_inr = $5, image_url = $6, sku = $7,
       in_stock = $8, active = $9, updated_at = now()
     WHERE workspace_id = $1::uuid AND id = $2::uuid
     RETURNING ${columns}`,
    [
      workspaceId,
      productId,
      input.name,
      input.description,
      input.priceInr,
      input.imageUrl,
      input.sku,
      input.inStock,
      input.active,
    ]
  );
  return toProduct(rows[0]);
}

/** Soft delete: the product drops out of active lists and AI context, but the row is kept. */
export async function disableCatalogProduct(workspaceId: string, productId: string): Promise<CatalogProduct | null> {
  const rows = await database().query(
    `UPDATE app_catalog_products SET active = false, updated_at = now()
     WHERE workspace_id = $1::uuid AND id = $2::uuid
     RETURNING ${columns}`,
    [workspaceId, productId]
  );
  return toProduct(rows[0]);
}

/**
 * Active products for AI context (used by the AI helper and chat-reply sessions).
 * Returns only active products, most recently updated first, capped at `limit`.
 */
export async function activeProductsForAi(workspaceId: string, limit = 20): Promise<CatalogProduct[]> {
  const rows = await database().query(
    `SELECT ${columns} FROM app_catalog_products
     WHERE workspace_id = $1::uuid AND active = true
     ORDER BY updated_at DESC, id
     LIMIT $2`,
    [workspaceId, clampLimit(limit, 20)]
  );
  return toProducts(rows);
}

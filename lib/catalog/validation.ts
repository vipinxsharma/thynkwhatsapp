import type { CatalogProductInput } from "@/lib/catalog/types";

export const MAX_PRODUCT_NAME = 120;
export const MAX_PRODUCT_DESCRIPTION = 1000;
export const MAX_IMAGE_URL = 2048;
export const MAX_SKU = 64;
// numeric(12,2) cannot hold more than 10 digits before the decimal point.
export const MAX_PRICE_INR = 9999999999.99;

const skuPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const pricePattern = /^\d{1,10}(\.\d{1,2})?$/;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Price in rupees: a number or numeric string, at most 2 decimals, 0 to 9,999,999,999.99. */
export function parsePriceInr(raw: unknown): ValidationResult<number> {
  let value: number;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return { ok: false, error: "Enter a price in rupees" };
    if (Math.abs(raw * 100 - Math.round(raw * 100)) > 1e-6) {
      return { ok: false, error: "Price can have at most 2 decimal places" };
    }
    value = raw;
  } else if (typeof raw === "string" && raw.trim() !== "") {
    const text = raw.trim();
    if (!pricePattern.test(text)) return { ok: false, error: "Enter a price like 499 or 499.50" };
    value = Number(text);
  } else {
    return { ok: false, error: "Enter a price in rupees" };
  }
  if (value < 0) return { ok: false, error: "Price cannot be negative" };
  if (value > MAX_PRICE_INR) return { ok: false, error: "Price is too large" };
  return { ok: true, value: Math.round(value * 100) / 100 };
}

/** Image must be an https URL. Empty means no image. */
export function parseImageUrl(raw: unknown): ValidationResult<string | null> {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "Image must be a web address" };
  const text = raw.trim();
  if (text === "") return { ok: true, value: null };
  if (text.length > MAX_IMAGE_URL) return { ok: false, error: "Image address is too long" };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: "Image must be a valid https address" };
  }
  if (url.protocol !== "https:" || !url.hostname) return { ok: false, error: "Image must start with https://" };
  return { ok: true, value: url.toString() };
}

/** SKU: letters, digits, dot, underscore, hyphen; up to 64 characters. Empty means no SKU. */
export function parseSku(raw: unknown): ValidationResult<string | null> {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "SKU must be text" };
  const text = raw.trim();
  if (text === "") return { ok: true, value: null };
  if (text.length > MAX_SKU) return { ok: false, error: "SKU can be at most 64 characters" };
  if (!skuPattern.test(text)) {
    return { ok: false, error: "SKU can use letters, numbers, dots, dashes and underscores" };
  }
  return { ok: true, value: text };
}

export function parseProductName(raw: unknown): ValidationResult<string> {
  if (typeof raw !== "string") return { ok: false, error: "Enter a product name" };
  const text = raw.trim();
  if (text.length < 1 || text.length > MAX_PRODUCT_NAME) {
    return { ok: false, error: `Product name must be 1 to ${MAX_PRODUCT_NAME} characters` };
  }
  return { ok: true, value: text };
}

export function parseProductDescription(raw: unknown): ValidationResult<string> {
  if (raw === null || raw === undefined) return { ok: true, value: "" };
  if (typeof raw !== "string") return { ok: false, error: "Description must be text" };
  const text = raw.trim();
  if (text.length > MAX_PRODUCT_DESCRIPTION) {
    return { ok: false, error: `Description can be at most ${MAX_PRODUCT_DESCRIPTION} characters` };
  }
  return { ok: true, value: text };
}

function parseFlag(raw: unknown, fallback: boolean): ValidationResult<boolean> {
  if (raw === undefined || raw === null) return { ok: true, value: fallback };
  if (typeof raw !== "boolean") return { ok: false, error: "Flags must be true or false" };
  return { ok: true, value: raw };
}

/**
 * Validates a full product body. Missing optional fields take defaults; for a PATCH,
 * pass the existing product as `base` so only the sent fields change.
 */
export function validateProductInput(
  body: unknown,
  base?: CatalogProductInput
): ValidationResult<CatalogProductInput> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Send a product as a JSON object" };
  }
  const source = body as Record<string, unknown>;
  const has = (key: string) => Object.prototype.hasOwnProperty.call(source, key);
  const pick = <K extends keyof CatalogProductInput>(key: K): unknown =>
    has(key) ? source[key] : base?.[key];

  const name = base && !has("name") ? { ok: true as const, value: base.name } : parseProductName(source.name);
  if (!name.ok) return name;
  const description = parseProductDescription(pick("description"));
  if (!description.ok) return description;
  const price = base && !has("priceInr") ? { ok: true as const, value: base.priceInr } : parsePriceInr(source.priceInr);
  if (!price.ok) return price;
  const imageUrl = parseImageUrl(pick("imageUrl"));
  if (!imageUrl.ok) return imageUrl;
  const sku = parseSku(pick("sku"));
  if (!sku.ok) return sku;
  const inStock = parseFlag(pick("inStock"), base?.inStock ?? true);
  if (!inStock.ok) return inStock;
  const active = parseFlag(pick("active"), base?.active ?? true);
  if (!active.ok) return active;

  return {
    ok: true,
    value: {
      name: name.value,
      description: description.value,
      priceInr: price.value,
      imageUrl: imageUrl.value,
      sku: sku.value,
      inStock: inStock.value,
      active: active.value,
    },
  };
}

export const productIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

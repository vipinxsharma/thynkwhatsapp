/**
 * Parses the `order` object of an inbound WhatsApp message (a shopper checked out from a linked
 * catalogue). Pure: no I/O. The webhook stores the summary as the message body and keeps the full
 * Meta payload in raw_payload, so the conversation timeline shows the order as one event.
 */

export interface CatalogOrderItem {
  productRetailerId: string;
  quantity: number;
  itemPrice: number;
  currency: string;
}

export interface ParsedCatalogOrder {
  catalogId: string | null;
  items: CatalogOrderItem[];
  /** Shopper's note attached to the order, trimmed and capped. */
  note: string | null;
  /** Sum of quantity x item price when every line uses one currency; null otherwise. */
  total: { amount: number; currency: string } | null;
}

const MAX_ITEMS = 200;
const MAX_QUANTITY = 10_000;
const MAX_RETAILER_ID_LENGTH = 200;
const MAX_NOTE_LENGTH = 1_000;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function parseItem(raw: unknown): CatalogOrderItem | null {
  if (!raw || typeof raw !== "object") return null;
  const line = raw as Record<string, unknown>;
  const productRetailerId = text(line.product_retailer_id, MAX_RETAILER_ID_LENGTH);
  // Meta sends quantity as a string in some payloads and a number in others.
  const quantity = Number(line.quantity);
  const itemPrice = Number(line.item_price);
  const currency = typeof line.currency === "string" ? line.currency.trim().toUpperCase() : "";
  if (!productRetailerId) return null;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) return null;
  if (!Number.isFinite(itemPrice) || itemPrice < 0) return null;
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  return { productRetailerId, quantity, itemPrice, currency };
}

/**
 * Returns null when the order cannot be trusted: no valid lines, or any line that does not parse.
 * A partly readable order is not summarised, because a wrong total is worse than no total.
 */
export function parseCatalogOrder(order: unknown): ParsedCatalogOrder | null {
  if (!order || typeof order !== "object") return null;
  const value = order as Record<string, unknown>;
  const rawItems = value.product_items;
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > MAX_ITEMS) return null;

  const items: CatalogOrderItem[] = [];
  for (const raw of rawItems) {
    const item = parseItem(raw);
    if (!item) return null;
    items.push(item);
  }

  const catalogId = typeof value.catalog_id === "string" || typeof value.catalog_id === "number"
    ? String(value.catalog_id)
    : "";
  const currencies = new Set(items.map((item) => item.currency));
  let total: ParsedCatalogOrder["total"] = null;
  if (currencies.size === 1) {
    const currency = items[0].currency;
    // Sum in minor units to avoid float drift, then convert back.
    const minor = items.reduce((sum, item) => sum + Math.round(item.itemPrice * 100) * item.quantity, 0);
    total = { amount: minor / 100, currency };
  }

  return {
    catalogId: /^\d{5,30}$/.test(catalogId) ? catalogId : null,
    items,
    note: text(value.text, MAX_NOTE_LENGTH),
    total,
  };
}

/** One-line timeline text, e.g. "Catalogue order: 2 items (3 units), total 299.00 INR". */
export function summarizeCatalogOrder(order: ParsedCatalogOrder): string {
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const parts = [`Catalogue order: ${order.items.length} ${order.items.length === 1 ? "item" : "items"} (${units} ${units === 1 ? "unit" : "units"})`];
  if (order.total) parts.push(`total ${order.total.amount.toFixed(2)} ${order.total.currency}`);
  let summary = parts.join(", ");
  if (order.note) summary += ` - ${order.note}`;
  return summary;
}

import { describe, expect, it } from "vitest";
import { parseCatalogOrder, summarizeCatalogOrder } from "@/lib/catalog/orders";

const line = (overrides: Record<string, unknown> = {}) => ({
  product_retailer_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  quantity: "2",
  item_price: 149.5,
  currency: "INR",
  ...overrides,
});

describe("parseCatalogOrder", () => {
  it("parses lines, reads string quantities and totals a single currency", () => {
    const parsed = parseCatalogOrder({
      catalog_id: "987654321",
      text: "  Gift wrap please  ",
      product_items: [line(), line({ product_retailer_id: "bbbb", quantity: 1, item_price: "50" })],
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.catalogId).toBe("987654321");
    expect(parsed?.items).toHaveLength(2);
    expect(parsed?.items[0]).toEqual({ productRetailerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", quantity: 2, itemPrice: 149.5, currency: "INR" });
    expect(parsed?.items[1].quantity).toBe(1);
    expect(parsed?.note).toBe("Gift wrap please");
    expect(parsed?.total).toEqual({ amount: 349, currency: "INR" });
  });

  it("sums in minor units so decimal prices do not drift", () => {
    const parsed = parseCatalogOrder({ product_items: [line({ quantity: 3, item_price: 0.1 })] });
    expect(parsed?.total).toEqual({ amount: 0.3, currency: "INR" });
  });

  it("normalises currency codes to upper case and leaves the total null when lines differ", () => {
    const mixed = parseCatalogOrder({ product_items: [line(), line({ currency: "usd" })] });
    expect(mixed?.items.map((item) => item.currency)).toEqual(["INR", "USD"]);
    expect(mixed?.total).toBeNull();
  });

  it("keeps the order but nulls a catalogue ID that is not numeric", () => {
    const parsed = parseCatalogOrder({ catalog_id: "not-an-id", product_items: [line()] });
    expect(parsed?.catalogId).toBeNull();
    expect(parsed?.items).toHaveLength(1);
  });

  it("rejects the whole order when any line cannot be trusted", () => {
    expect(parseCatalogOrder({ product_items: [line(), line({ quantity: 0 })] })).toBeNull();
    expect(parseCatalogOrder({ product_items: [line({ quantity: 1.5 })] })).toBeNull();
    expect(parseCatalogOrder({ product_items: [line({ item_price: -1 })] })).toBeNull();
    expect(parseCatalogOrder({ product_items: [line({ item_price: "abc" })] })).toBeNull();
    expect(parseCatalogOrder({ product_items: [line({ product_retailer_id: "" })] })).toBeNull();
    expect(parseCatalogOrder({ product_items: [line({ currency: "RUPEES" })] })).toBeNull();
  });

  it("rejects missing, empty or oversized item lists and non-object input", () => {
    expect(parseCatalogOrder(undefined)).toBeNull();
    expect(parseCatalogOrder("order")).toBeNull();
    expect(parseCatalogOrder({})).toBeNull();
    expect(parseCatalogOrder({ product_items: [] })).toBeNull();
    expect(parseCatalogOrder({ product_items: Array.from({ length: 201 }, () => line()) })).toBeNull();
  });

  it("drops an over-long note instead of rejecting the order", () => {
    const parsed = parseCatalogOrder({ text: "x".repeat(1001), product_items: [line()] });
    expect(parsed?.note).toBeNull();
    expect(parsed?.items).toHaveLength(1);
  });
});

describe("summarizeCatalogOrder", () => {
  it("writes a one-line summary with items, units, total and note", () => {
    const parsed = parseCatalogOrder({ text: "Ring the bell", product_items: [line(), line({ quantity: 1 })] });
    expect(summarizeCatalogOrder(parsed!)).toBe("Catalogue order: 2 items (3 units), total 448.50 INR - Ring the bell");
  });

  it("uses singular words and omits the total when currencies differ", () => {
    const parsed = parseCatalogOrder({ product_items: [line({ quantity: 1 })], catalog_id: null });
    expect(summarizeCatalogOrder(parsed!)).toBe("Catalogue order: 1 item (1 unit), total 149.50 INR");
    const mixed = parseCatalogOrder({ product_items: [line(), line({ currency: "USD" })] });
    expect(summarizeCatalogOrder(mixed!)).toBe("Catalogue order: 2 items (4 units)");
  });
});

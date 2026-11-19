import { describe, expect, it } from "vitest";
import { evaluateProductEligibility } from "@/lib/catalog/eligibility";
import { toMetaItem, type CatalogProductForSync } from "@/lib/meta/catalog-sync";
import type { CatalogLink, CatalogSyncItemRecord } from "@/lib/meta/catalog-store";

const PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const product = (overrides: Partial<CatalogProductForSync> = {}): CatalogProductForSync => ({
  id: PRODUCT_ID,
  name: "Masala Chai",
  description: "Hand-blended tea",
  priceInr: 149.5,
  currency: "INR",
  imageUrl: "https://cdn.example.com/chai.jpg",
  sku: "CHAI-1",
  inStock: true,
  active: true,
  updatedAt: "2026-11-01T00:00:00Z",
  ...overrides,
});

const linkedCatalog = (overrides: Partial<CatalogLink> = {}): CatalogLink => ({
  workspaceId: "11111111-1111-4111-8111-111111111111",
  metaCatalogId: "987654321",
  wabaId: "123456789",
  status: "linked",
  lastSyncedAt: "2026-11-18T10:00:00Z",
  lastError: null,
  ...overrides,
});

/** Sync record as a successful sync would leave it: the hash of exactly what Meta received. */
const syncedRecord = (p: CatalogProductForSync, overrides: Partial<CatalogSyncItemRecord> = {}): CatalogSyncItemRecord => {
  const prepared = toMetaItem(p);
  if ("skipped" in prepared) throw new Error("fixture product must be sendable");
  return {
    productId: p.id,
    metaRetailerId: prepared.retailerId,
    lastHash: prepared.hash,
    lastSyncedAt: "2026-11-18T10:00:00Z",
    status: "synced",
    error: null,
    ...overrides,
  };
};

describe("evaluateProductEligibility", () => {
  it("allows a live, in-stock product whose current data was synced", () => {
    const p = product();
    const result = evaluateProductEligibility({ link: linkedCatalog(), product: p, syncItem: syncedRecord(p) });
    expect(result).toEqual({
      eligible: true,
      catalogId: "987654321",
      linkedWabaId: "123456789",
      retailerId: PRODUCT_ID,
      productName: "Masala Chai",
    });
  });

  it("blocks when the catalogue is not linked (no link, no catalogue ID, or not yet linked)", () => {
    const p = product();
    const sync = syncedRecord(p);
    expect(evaluateProductEligibility({ link: null, product: p, syncItem: sync })).toMatchObject({ eligible: false, reason: "catalog_not_linked" });
    expect(evaluateProductEligibility({ link: linkedCatalog({ metaCatalogId: null }), product: p, syncItem: sync })).toMatchObject({ reason: "catalog_not_linked" });
    expect(evaluateProductEligibility({ link: linkedCatalog({ status: "pending" }), product: p, syncItem: sync })).toMatchObject({ reason: "catalog_not_linked" });
    // A sync with any failed batch leaves the link in error; catalogue messages wait for a clean sync.
    expect(evaluateProductEligibility({ link: linkedCatalog({ status: "error" }), product: p, syncItem: sync })).toMatchObject({ reason: "catalog_not_linked" });
  });

  it("blocks a product that does not exist in the workspace", () => {
    expect(evaluateProductEligibility({ link: linkedCatalog(), product: null, syncItem: null })).toMatchObject({ reason: "product_not_found" });
  });

  it("blocks disabled and out-of-stock products", () => {
    const inactive = product({ active: false });
    expect(evaluateProductEligibility({ link: linkedCatalog(), product: inactive, syncItem: syncedRecord(inactive) })).toMatchObject({ reason: "product_inactive" });
    const oos = product({ inStock: false });
    expect(evaluateProductEligibility({ link: linkedCatalog(), product: oos, syncItem: syncedRecord(oos) })).toMatchObject({ reason: "product_out_of_stock" });
  });

  it("blocks products Meta cannot accept: no image, or an invalid price", () => {
    const noImage = product({ imageUrl: null });
    expect(evaluateProductEligibility({ link: linkedCatalog(), product: noImage, syncItem: null })).toMatchObject({ reason: "product_missing_image" });
    const badPrice = product({ priceInr: "not-a-number" });
    expect(evaluateProductEligibility({ link: linkedCatalog(), product: badPrice, syncItem: null })).toMatchObject({ reason: "product_invalid_price" });
  });

  it("blocks a product that was never synced, failed, or changed since its last sync", () => {
    const p = product();
    expect(evaluateProductEligibility({ link: linkedCatalog(), product: p, syncItem: null })).toMatchObject({ reason: "product_not_synced" });
    expect(evaluateProductEligibility({ link: linkedCatalog(), product: p, syncItem: syncedRecord(p, { status: "error", error: "bad batch" }) }))
      .toMatchObject({ reason: "product_not_synced" });
    const edited = product({ priceInr: 199 });
    expect(evaluateProductEligibility({ link: linkedCatalog(), product: edited, syncItem: syncedRecord(p) })).toMatchObject({ reason: "product_not_synced" });
  });

  it("returns a null WABA when the link has none, so the send path refuses it", () => {
    const p = product();
    const result = evaluateProductEligibility({ link: linkedCatalog({ wabaId: null }), product: p, syncItem: syncedRecord(p) });
    expect(result).toMatchObject({ eligible: true, linkedWabaId: null });
  });

  it("gives every ineligible result a message the dashboard can show", () => {
    const result = evaluateProductEligibility({ link: null, product: null, syncItem: null });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.message.length).toBeGreaterThan(10);
  });
});

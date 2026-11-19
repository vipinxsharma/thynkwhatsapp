import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const store = vi.hoisted(() => ({
  getCatalogLink: vi.fn(async (..._args: unknown[]) => null as unknown),
  upsertCatalogLink: vi.fn(async (..._args: unknown[]) => undefined),
  listCatalogSyncItems: vi.fn(async (..._args: unknown[]) => [] as unknown[]),
  recordCatalogSyncItems: vi.fn(async (..._args: unknown[]) => undefined),
  listCatalogProductsForSync: vi.fn(async (..._args: unknown[]) => [] as unknown[]),
}));
const auth = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => ({ ok: true, session: { tenantId: "11111111-1111-4111-8111-111111111111", userId: "u1", role: "owner" } }) as any));

vi.mock("@/lib/meta/catalog-store", () => store);
vi.mock("@/lib/auth/session", () => ({ requireApiSession: auth }));
vi.mock("@/lib/meta/connections", () => ({
  getMetaConnectionForWorkspace: vi.fn(async () => ({ accessToken: "tok_test", wabaId: "123456789", workspaceId: "w", phoneNumberId: "1" })),
}));

import {
  chunkItems,
  formatPrice,
  availabilityFor,
  hashItem,
  planItems,
  planWorkspaceCatalog,
  syncWorkspaceCatalog,
  toMetaItem,
  type CatalogProductForSync,
} from "@/lib/meta/catalog-sync";
import { GET, POST } from "../app/api/meta/catalog/route";

const product = (overrides: Partial<CatalogProductForSync> = {}): CatalogProductForSync => ({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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

const manyProducts = (count: number): CatalogProductForSync[] =>
  Array.from({ length: count }, (_, i) => product({ id: `p-${String(i).padStart(5, "0")}`, name: `Item ${i}` }));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.META_APP_SECRET = "test_secret";
  delete process.env.META_CATALOG_LIVE;
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ handles: [] }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  store.getCatalogLink.mockResolvedValue({ workspaceId: "w", metaCatalogId: "987654321", wabaId: "123456789", status: "linked", lastSyncedAt: null, lastError: null });
  store.listCatalogSyncItems.mockResolvedValue([]);
  store.listCatalogProductsForSync.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  delete process.env.META_CATALOG_LIVE;
});

describe("item formatting", () => {
  it("formats price as an amount with two decimals and INR", () => {
    expect(formatPrice(149.5)).toBe("149.50 INR");
    expect(formatPrice("1200")).toBe("1200.00 INR");
    expect(formatPrice(-1)).toBeNull();
    expect(formatPrice("abc")).toBeNull();
  });

  it("maps availability: active and in stock is in stock, anything else is out of stock", () => {
    expect(availabilityFor({ active: true, inStock: true })).toBe("in stock");
    expect(availabilityFor({ active: true, inStock: false })).toBe("out of stock");
    expect(availabilityFor({ active: false, inStock: true })).toBe("out of stock");
  });

  it("uses the product id as the retailer id and builds the Meta data", () => {
    const item = toMetaItem(product());
    expect(item).toMatchObject({
      productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      retailerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      data: {
        name: "Masala Chai",
        description: "Hand-blended tea",
        price: "149.50 INR",
        currency: "INR",
        availability: "in stock",
        image_link: "https://cdn.example.com/chai.jpg",
      },
    });
  });

  it("skips products Meta cannot accept (no image, bad price) instead of sending them", () => {
    expect(toMetaItem(product({ imageUrl: null }))).toEqual({ skipped: "missing image" });
    expect(toMetaItem(product({ priceInr: "free?" }))).toEqual({ skipped: "invalid price" });
  });
});

describe("hashing and change detection", () => {
  it("gives the same hash for identical data and a different hash when price changes", () => {
    const a = toMetaItem(product()) as { hash: string };
    const b = toMetaItem(product()) as { hash: string };
    const c = toMetaItem(product({ priceInr: 160 })) as { hash: string };
    expect(a.hash).toBe(b.hash);
    expect(a.hash).not.toBe(c.hash);
    expect(hashItem("x", { name: "a", description: "", price: "1.00 INR", currency: "INR", availability: "in stock", image_link: "i" }))
      .toBe(hashItem("x", { image_link: "i", availability: "in stock", currency: "INR", price: "1.00 INR", description: "", name: "a" }));
  });

  it("skips unchanged products and only resends changed or new ones", () => {
    const unchanged = product();
    const changed = product({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", priceInr: 99 });
    const fresh = product({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" });
    const lastSent = new Map<string, string | null>([
      [unchanged.id, (toMetaItem(unchanged) as { hash: string }).hash],
      [changed.id, "stale-hash"],
    ]);
    const plan = planItems([unchanged, changed, fresh], lastSent);
    expect(plan.unchanged.map((item) => item.productId)).toEqual([unchanged.id]);
    expect(plan.toUpdate.map((item) => item.productId)).toEqual([changed.id]);
    expect(plan.toCreate.map((item) => item.productId)).toEqual([fresh.id]);
  });
});

describe("batching", () => {
  it("splits items into batches of at most 500", () => {
    const batches = chunkItems(Array.from({ length: 1201 }, (_, i) => i));
    expect(batches.map((batch) => batch.length)).toEqual([500, 500, 201]);
    expect(Math.max(...batches.map((batch) => batch.length))).toBeLessThanOrEqual(500);
  });

  it("sends a live sync in batches of at most 500 and never sends a DELETE", async () => {
    process.env.META_CATALOG_LIVE = "true";
    store.listCatalogProductsForSync.mockResolvedValue(manyProducts(1200));
    const result = await syncWorkspaceCatalog("11111111-1111-4111-8111-111111111111");
    const batchCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/items_batch"));
    expect(batchCalls).toHaveLength(3);
    for (const [, init] of batchCalls) {
      const body = (init as RequestInit).body as URLSearchParams;
      const requests = JSON.parse(body.get("requests") as string) as Array<{ method: string }>;
      expect(requests.length).toBeLessThanOrEqual(500);
      expect(requests.every((request) => request.method === "UPDATE")).toBe(true);
    }
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")).toBe(false);
    expect(result.sent).toBe(1200);
    expect(result.batches).toBe(3);
  });
});

describe("dry run", () => {
  it("makes zero Meta calls and reports what it would create or update", async () => {
    store.listCatalogProductsForSync.mockResolvedValue([
      product(),
      product({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", priceInr: 99 }),
      product({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", imageUrl: null }),
    ]);
    store.listCatalogSyncItems.mockResolvedValue([
      { productId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", metaRetailerId: "x", lastHash: "stale", lastSyncedAt: null, status: "synced", error: null },
    ]);
    const result = await syncWorkspaceCatalog("11111111-1111-4111-8111-111111111111");
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(result.mode).toBe("dry-run");
    expect(result.plan.counts).toEqual({ create: 1, update: 1, unchanged: 0, skipped: 1 });
    expect(store.recordCatalogSyncItems).not.toHaveBeenCalled();
    expect(store.upsertCatalogLink).not.toHaveBeenCalled();
  });

  it("does not create a catalog when no link exists and live is off", async () => {
    store.getCatalogLink.mockResolvedValue(null);
    store.listCatalogProductsForSync.mockResolvedValue([product()]);
    const plan = await planWorkspaceCatalog("11111111-1111-4111-8111-111111111111");
    expect(plan.willCreateCatalog).toBe(true);
    const result = await syncWorkspaceCatalog("11111111-1111-4111-8111-111111111111");
    expect(result.mode).toBe("dry-run");
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("returns an empty plan when the product table is absent (reader gives an empty list)", async () => {
    store.listCatalogProductsForSync.mockResolvedValue([]);
    const plan = await planWorkspaceCatalog("11111111-1111-4111-8111-111111111111");
    expect(plan.counts).toEqual({ create: 0, update: 0, unchanged: 0, skipped: 0 });
  });
});

describe("route", () => {
  const post = (body: unknown) =>
    new NextRequest("https://app.example.com/api/meta/catalog", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://app.example.com" },
      body: JSON.stringify(body),
    });

  it("refuses sync when META_CATALOG_LIVE is not true and makes no Meta calls", async () => {
    const response = await POST(post({ action: "sync" }));
    expect(response.status).toBe(409);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("returns a dry-run plan for action plan", async () => {
    const response = await POST(post({ action: "plan" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(((await response.json()) as { mode: string }).mode).toBe("dry-run");
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("rejects an unknown action", async () => {
    const response = await POST(post({ action: "delete" }));
    expect(response.status).toBe(400);
  });

  it("serves link status to agents with no-store", async () => {
    auth.mockResolvedValueOnce({ ok: true, session: { tenantId: "t", userId: "u", role: "agent" } });
    const response = await GET(new NextRequest("https://app.example.com/api/meta/catalog"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});

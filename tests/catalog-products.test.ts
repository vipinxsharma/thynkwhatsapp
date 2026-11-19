import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  disable: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireApiSession: mocks.auth }));
vi.mock("@/lib/catalog/products", () => ({
  listCatalogProducts: mocks.list,
  getCatalogProduct: mocks.get,
  createCatalogProduct: mocks.create,
  updateCatalogProduct: mocks.update,
  disableCatalogProduct: mocks.disable,
}));

import { GET, POST } from "../app/api/catalog/products/route";
import { DELETE, GET as GET_ONE, PATCH } from "../app/api/catalog/products/[productId]/route";
import { parseImageUrl, parsePriceInr, parseSku, validateProductInput } from "../lib/catalog/validation";

const session = { userId: "user-1", email: "owner@example.test", tenantId: "ws-1", tenantName: "WS", role: "owner" };
const productId = "6f1c2a3e-1b2c-4d5e-8f90-123456789abc";
const product = {
  id: productId,
  name: "Blue kurta",
  description: "Cotton",
  priceInr: 1499,
  currency: "INR" as const,
  imageUrl: "https://cdn.example.test/kurta.jpg",
  sku: "KUR-01",
  inStock: true,
  active: true,
  updatedAt: "2026-11-19T00:00:00.000Z",
};

function request(url: string, init?: { method?: string; body?: unknown }): NextRequest {
  return new NextRequest(url, {
    method: init?.method ?? "GET",
    headers: { "content-type": "application/json", origin: "https://xeccel.com" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const collectionUrl = "https://xeccel.com/api/catalog/products";
const itemUrl = `${collectionUrl}/${productId}`;
const itemContext = { params: Promise.resolve({ productId }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ ok: true, session });
});

describe("price validation", () => {
  it("accepts whole rupees and up to two decimals", () => {
    expect(parsePriceInr(499)).toEqual({ ok: true, value: 499 });
    expect(parsePriceInr("499.50")).toEqual({ ok: true, value: 499.5 });
    expect(parsePriceInr("0")).toEqual({ ok: true, value: 0 });
  });

  it("rejects negative, empty, malformed and over-precise prices", () => {
    expect(parsePriceInr(-1).ok).toBe(false);
    expect(parsePriceInr("").ok).toBe(false);
    expect(parsePriceInr("abc").ok).toBe(false);
    expect(parsePriceInr("1,499").ok).toBe(false);
    expect(parsePriceInr("1.999").ok).toBe(false);
    expect(parsePriceInr(10.005).ok).toBe(false);
    expect(parsePriceInr(undefined).ok).toBe(false);
  });

  it("rejects amounts too large for numeric(12,2)", () => {
    expect(parsePriceInr("9999999999.99").ok).toBe(true);
    expect(parsePriceInr("10000000000").ok).toBe(false);
  });
});

describe("image URL validation", () => {
  it("accepts https and treats empty as no image", () => {
    expect(parseImageUrl("https://cdn.example.test/a.png")).toMatchObject({ ok: true });
    expect(parseImageUrl("   ")).toEqual({ ok: true, value: null });
    expect(parseImageUrl(null)).toEqual({ ok: true, value: null });
  });

  it("rejects http, javascript, data and malformed addresses", () => {
    expect(parseImageUrl("http://cdn.example.test/a.png").ok).toBe(false);
    expect(parseImageUrl("javascript:alert(1)").ok).toBe(false);
    expect(parseImageUrl("data:image/png;base64,AAAA").ok).toBe(false);
    expect(parseImageUrl("not a url").ok).toBe(false);
    expect(parseImageUrl(42).ok).toBe(false);
  });
});

describe("SKU validation", () => {
  it("accepts letters, digits, dots, dashes and underscores", () => {
    expect(parseSku("KUR-01.blue_L")).toEqual({ ok: true, value: "KUR-01.blue_L" });
    expect(parseSku("")).toEqual({ ok: true, value: null });
  });

  it("rejects spaces, leading punctuation and more than 64 characters", () => {
    expect(parseSku("KUR 01").ok).toBe(false);
    expect(parseSku("-KUR").ok).toBe(false);
    expect(parseSku("A".repeat(65)).ok).toBe(false);
    expect(parseSku("A".repeat(64)).ok).toBe(true);
  });
});

describe("product input validation", () => {
  it("fills defaults for a create with only a name and price", () => {
    const result = validateProductInput({ name: " Mug ", priceInr: "250" });
    expect(result).toEqual({
      ok: true,
      value: { name: "Mug", description: "", priceInr: 250, imageUrl: null, sku: null, inStock: true, active: true },
    });
  });

  it("requires a name of 1 to 120 characters and a description of at most 1000", () => {
    expect(validateProductInput({ name: "   ", priceInr: 1 }).ok).toBe(false);
    expect(validateProductInput({ name: "x".repeat(121), priceInr: 1 }).ok).toBe(false);
    expect(validateProductInput({ name: "ok", priceInr: 1, description: "d".repeat(1001) }).ok).toBe(false);
  });

  it("rejects a non-object body and non-boolean flags", () => {
    expect(validateProductInput(null).ok).toBe(false);
    expect(validateProductInput([]).ok).toBe(false);
    expect(validateProductInput({ name: "ok", priceInr: 1, inStock: "yes" }).ok).toBe(false);
  });

  it("keeps the existing values for fields a PATCH does not send", () => {
    const base = { name: "Mug", description: "Old", priceInr: 250, imageUrl: null, sku: "M-1", inStock: false, active: true };
    const result = validateProductInput({ priceInr: "300" }, base);
    expect(result).toEqual({ ok: true, value: { ...base, priceInr: 300 } });
  });
});

describe("catalogue collection route", () => {
  it("lists products for the signed-in workspace with no-store caching", async () => {
    mocks.list.mockResolvedValue([product]);
    const response = await GET(request(`${collectionUrl}?search=kurta&active=true&inStock=false`));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).data).toEqual([product]);
    expect(mocks.auth).toHaveBeenCalledWith(expect.anything(), ["owner", "admin", "agent"]);
    expect(mocks.list).toHaveBeenCalledWith("ws-1", { search: "kurta", active: true, inStock: false, limit: undefined, offset: undefined });
  });

  it("returns 503 when the store fails", async () => {
    mocks.list.mockRejectedValue(new Error("db down"));
    const response = await GET(request(collectionUrl));
    expect(response.status).toBe(503);
  });

  it("creates a valid product and returns 201", async () => {
    mocks.create.mockResolvedValue(product);
    const response = await POST(request(collectionUrl, { method: "POST", body: { name: "Blue kurta", priceInr: "1499" } }));
    expect(response.status).toBe(201);
    expect(mocks.auth).toHaveBeenCalledWith(expect.anything(), ["owner", "admin"]);
    expect(mocks.create).toHaveBeenCalledWith("ws-1", expect.objectContaining({ name: "Blue kurta", priceInr: 1499 }));
  });

  it("rejects invalid input without touching the store", async () => {
    const response = await POST(request(collectionUrl, { method: "POST", body: { name: "Mug", priceInr: -5 } }));
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("reports a duplicate SKU as a conflict", async () => {
    mocks.create.mockRejectedValue(Object.assign(new Error("duplicate"), { code: "23505" }));
    const response = await POST(request(collectionUrl, { method: "POST", body: { name: "Mug", priceInr: 1, sku: "KUR-01" } }));
    expect(response.status).toBe(409);
  });

  it("passes through the auth failure for roles that may not write", async () => {
    mocks.auth.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    const response = await POST(request(collectionUrl, { method: "POST", body: { name: "Mug", priceInr: 1 } }));
    expect(response.status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("catalogue item route", () => {
  it("returns one product and 404 for a malformed or unknown id", async () => {
    mocks.get.mockResolvedValue(product);
    expect((await GET_ONE(request(itemUrl), itemContext)).status).toBe(200);

    const bad = await GET_ONE(request(`${collectionUrl}/not-an-id`), { params: Promise.resolve({ productId: "not-an-id" }) });
    expect(bad.status).toBe(404);
    expect(mocks.get).toHaveBeenCalledTimes(1);

    mocks.get.mockResolvedValue(null);
    expect((await GET_ONE(request(itemUrl), itemContext)).status).toBe(404);
  });

  it("patches only the sent fields", async () => {
    mocks.get.mockResolvedValue(product);
    mocks.update.mockResolvedValue({ ...product, inStock: false });
    const response = await PATCH(request(itemUrl, { method: "PATCH", body: { inStock: false } }), itemContext);
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      "ws-1",
      productId,
      expect.objectContaining({ name: "Blue kurta", priceInr: 1499, inStock: false, sku: "KUR-01" })
    );
  });

  it("refuses an invalid PATCH before writing", async () => {
    mocks.get.mockResolvedValue(product);
    const response = await PATCH(request(itemUrl, { method: "PATCH", body: { imageUrl: "http://insecure.test/a.png" } }), itemContext);
    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("disables rather than deletes a product", async () => {
    mocks.disable.mockResolvedValue({ ...product, active: false });
    const response = await DELETE(request(itemUrl, { method: "DELETE" }), itemContext);
    expect(response.status).toBe(200);
    expect((await response.json()).data.active).toBe(false);
    expect(mocks.disable).toHaveBeenCalledWith("ws-1", productId);
    expect(mocks.auth).toHaveBeenCalledWith(expect.anything(), ["owner", "admin"]);
  });
});

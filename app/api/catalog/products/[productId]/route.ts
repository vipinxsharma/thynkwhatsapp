import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { disableCatalogProduct, getCatalogProduct, updateCatalogProduct } from "@/lib/catalog/products";
import { productIdPattern, validateProductInput } from "@/lib/catalog/validation";

const noStore = { "Cache-Control": "no-store" };
type Context = { params: Promise<{ productId: string }> };

function invalidId() {
  return NextResponse.json({ error: "Product not found" }, { status: 404, headers: noStore });
}

export async function GET(request: NextRequest, context: Context) {
  const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
  if (!auth.ok) return auth.response;
  const { productId } = await context.params;
  if (!productIdPattern.test(productId)) return invalidId();
  try {
    const product = await getCatalogProduct(auth.session.tenantId, productId);
    if (!product) return invalidId();
    return NextResponse.json({ data: product }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Catalogue is temporarily unavailable" }, { status: 503, headers: noStore });
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const { productId } = await context.params;
  if (!productIdPattern.test(productId)) return invalidId();
  const body = await request.json().catch(() => null);
  try {
    const existing = await getCatalogProduct(auth.session.tenantId, productId);
    if (!existing) return invalidId();
    const { id: _id, updatedAt: _updatedAt, currency: _currency, ...base } = existing;
    const input = validateProductInput(body, base);
    if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400, headers: noStore });
    const data = await updateCatalogProduct(auth.session.tenantId, productId, input.value);
    if (!data) return invalidId();
    return NextResponse.json({ data }, { headers: noStore });
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      return NextResponse.json({ error: "Another product already uses this SKU" }, { status: 409, headers: noStore });
    }
    return NextResponse.json({ error: "Product could not be saved. Please try again." }, { status: 503, headers: noStore });
  }
}

/** Soft delete: sets active to false. The row is kept so history and AI context stay consistent. */
export async function DELETE(request: NextRequest, context: Context) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const { productId } = await context.params;
  if (!productIdPattern.test(productId)) return invalidId();
  try {
    const data = await disableCatalogProduct(auth.session.tenantId, productId);
    if (!data) return invalidId();
    return NextResponse.json({ data }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Product could not be disabled. Please try again." }, { status: 503, headers: noStore });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { createCatalogProduct, listCatalogProducts } from "@/lib/catalog/products";
import { validateProductInput } from "@/lib/catalog/validation";

const noStore = { "Cache-Control": "no-store" };

function parseFlag(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
  if (!auth.ok) return auth.response;
  const params = request.nextUrl.searchParams;
  const limit = Number(params.get("limit") ?? "");
  const offset = Number(params.get("offset") ?? "");
  try {
    const data = await listCatalogProducts(auth.session.tenantId, {
      search: params.get("search")?.slice(0, 120) ?? undefined,
      active: parseFlag(params.get("active")),
      inStock: parseFlag(params.get("inStock")),
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
      offset: Number.isFinite(offset) && offset > 0 ? offset : undefined,
    });
    return NextResponse.json({ data }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Catalogue is temporarily unavailable" }, { status: 503, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null);
  const input = validateProductInput(body);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400, headers: noStore });
  try {
    const data = await createCatalogProduct(auth.session.tenantId, input.value);
    return NextResponse.json({ data }, { status: 201, headers: noStore });
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      return NextResponse.json({ error: "Another product already uses this SKU" }, { status: 409, headers: noStore });
    }
    return NextResponse.json({ error: "Product could not be saved. Please try again." }, { status: 503, headers: noStore });
  }
}

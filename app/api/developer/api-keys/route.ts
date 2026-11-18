import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { createApiKey, listApiKeys } from "@/lib/developer/api-key-store";
import { developerStorageConfigured } from "@/lib/developer/db";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  if (!developerStorageConfigured()) return NextResponse.json({ error: "Developer API storage is not configured" }, { status: 503 });
  return NextResponse.json({ data: await listApiKeys(auth.session.tenantId) }, { headers: NO_STORE });
}

/** Creates a key. The full key is in the response once and is never shown again. */
export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  if (!developerStorageConfigured()) return NextResponse.json({ error: "Developer API storage is not configured" }, { status: 503 });

  let body: { name?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 80) {
    return NextResponse.json({ error: "Name must be 1 to 80 characters" }, { status: 400 });
  }

  const created = await createApiKey({
    workspaceId: auth.session.tenantId,
    authUserId: auth.session.userId,
    name,
  });
  const { key, ...summary } = created;
  return NextResponse.json({ data: summary, key }, { status: 201, headers: NO_STORE });
}

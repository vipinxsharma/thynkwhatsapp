import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { isDurableInboxEnabled } from "@/lib/strapi/client";
import { normalizeStageName } from "@/lib/leads/rules";
import { createStage, deleteStage, listStages, renameStage, reorderStages } from "@/lib/leads/store";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORAGE_DISABLED = { error: "Durable inbox storage is not configured" };

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";
}

async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  if (!isDurableInboxEnabled()) return NextResponse.json(STORAGE_DISABLED, { status: 503 });
  return NextResponse.json({ data: await listStages(auth.session.tenantId) });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  if (!isDurableInboxEnabled()) return NextResponse.json(STORAGE_DISABLED, { status: 503 });
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const name = normalizeStageName(body.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
  try {
    const stage = await createStage(auth.session.tenantId, name.name);
    return NextResponse.json({ data: stage }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: "A stage with this name already exists" }, { status: 409 });
    throw error;
  }
}

/** Renames one stage: `{ id, name }`. */
export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  if (!isDurableInboxEnabled()) return NextResponse.json(STORAGE_DISABLED, { status: 503 });
  const body = await readJson(request);
  if (!body || typeof body.id !== "string" || !uuid.test(body.id)) {
    return NextResponse.json({ error: "id must be a stage id" }, { status: 400 });
  }
  const name = normalizeStageName(body.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
  try {
    const stage = await renameStage(auth.session.tenantId, body.id, name.name);
    return stage
      ? NextResponse.json({ data: stage })
      : NextResponse.json({ error: "Stage not found" }, { status: 404 });
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: "A stage with this name already exists" }, { status: 409 });
    throw error;
  }
}

/** Sets the stage order: `{ order: [stageId, ...] }` must list every stage exactly once. */
export async function PUT(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  if (!isDurableInboxEnabled()) return NextResponse.json(STORAGE_DISABLED, { status: 503 });
  const body = await readJson(request);
  const order = body?.order;
  if (!Array.isArray(order) || !order.every((id) => typeof id === "string" && uuid.test(id))) {
    return NextResponse.json({ error: "order must be a list of stage ids" }, { status: 400 });
  }
  const ok = await reorderStages(auth.session.tenantId, order as string[]);
  return ok
    ? NextResponse.json({ data: await listStages(auth.session.tenantId) })
    : NextResponse.json({ error: "order must include every stage exactly once" }, { status: 409 });
}

/** Deletes a stage. Its leads move to the default "New" stage. The default stage cannot be deleted. */
export async function DELETE(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  if (!isDurableInboxEnabled()) return NextResponse.json(STORAGE_DISABLED, { status: 503 });
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!uuid.test(id)) return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  const result = await deleteStage(auth.session.tenantId, id);
  if (result.status === "protected") {
    return NextResponse.json({ error: "The default stage cannot be deleted" }, { status: 400 });
  }
  if (result.status === "not_found") return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  return NextResponse.json({ success: true, movedLeads: result.movedLeads });
}

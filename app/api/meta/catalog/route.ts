import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { catalogLiveEnabled, connectWorkspaceCatalog, planWorkspaceCatalog, syncWorkspaceCatalog } from "@/lib/meta/catalog-sync";

const noStore = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

/** Link status and the last sync result. Reads only; makes no Meta calls. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
    if (!auth.ok) {
      auth.response.headers.set("Cache-Control", "no-store");
      return auth.response;
    }
    const plan = await planWorkspaceCatalog(auth.session.tenantId);
    return json({
      live: catalogLiveEnabled(),
      link: plan.link,
      counts: plan.counts,
      skipped: plan.skipped,
    });
  } catch (error: any) {
    console.error("[Meta Catalog GET Error]", error);
    return json({ error: error.message || "Failed to read the catalog link" }, 500);
  }
}

/**
 * `plan` returns what a sync would do (never calls Meta). `connect` saves a customer-owned catalogue ID
 * as pending (no Meta call). `sync` writes to Meta and is refused unless META_CATALOG_LIVE is "true".
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request, ["owner", "admin"]);
    if (!auth.ok) {
      auth.response.headers.set("Cache-Control", "no-store");
      return auth.response;
    }
    const body = (await request.json().catch(() => null)) as { action?: unknown; catalogId?: unknown } | null;
    const action = body?.action;
    if (action === "connect") {
      const result = await connectWorkspaceCatalog(auth.session.tenantId, String(body?.catalogId ?? "").trim());
      if (!result.ok) return json({ error: result.error }, result.status);
      const plan = await planWorkspaceCatalog(auth.session.tenantId);
      return json({ mode: "dry-run", connected: result, plan });
    }
    if (action !== "plan" && action !== "sync") {
      return json({ error: 'action must be "plan", "sync" or "connect"' }, 400);
    }

    if (action === "plan") {
      const plan = await planWorkspaceCatalog(auth.session.tenantId);
      return json({ mode: "dry-run", plan });
    }

    if (!catalogLiveEnabled()) {
      return json({ error: "Live catalog sync is disabled. Set META_CATALOG_LIVE=true to enable it." }, 409);
    }
    const result = await syncWorkspaceCatalog(auth.session.tenantId);
    return json(result, result.error ? 502 : 200);
  } catch (error: any) {
    console.error("[Meta Catalog POST Error]", error);
    return json({ error: error.message || "Failed to run the catalog action" }, 500);
  }
}

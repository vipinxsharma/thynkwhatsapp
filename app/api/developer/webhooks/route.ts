import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { developerStorageConfigured } from "@/lib/developer/db";
import { deleteWebhookConfig, getWebhookConfig, saveWebhookConfig } from "@/lib/developer/webhook-store";
import { validateWebhookEvents, validateWebhookUrl } from "@/lib/developer/webhook-signing";

const NO_STORE = { "Cache-Control": "no-store" };

function unavailable(): NextResponse | null {
  if (!developerStorageConfigured()) return NextResponse.json({ error: "Developer API storage is not configured" }, { status: 503 });
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
    return NextResponse.json({ error: "Webhook signing is not configured on this server" }, { status: 503 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  if (!developerStorageConfigured()) return NextResponse.json({ error: "Developer API storage is not configured" }, { status: 503 });
  return NextResponse.json({ data: await getWebhookConfig(auth.session.tenantId) }, { headers: NO_STORE });
}

/**
 * Creates or updates the workspace subscription. The signing secret is returned only when the
 * subscription is first created. Use rotate-secret to get a new one later.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const misconfigured = unavailable();
  if (misconfigured) return misconfigured;

  let body: { url?: unknown; events?: unknown; enabled?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const url = validateWebhookUrl(body.url, { allowLocalHttp: process.env.NODE_ENV !== "production" });
  if (!url.ok) return NextResponse.json({ error: url.error }, { status: 400 });
  const events = validateWebhookEvents(body.events);
  if (!events.ok) return NextResponse.json({ error: events.error }, { status: 400 });
  if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be true or false" }, { status: 400 });
  }

  const saved = await saveWebhookConfig({
    workspaceId: auth.session.tenantId,
    authUserId: auth.session.userId,
    url: url.url,
    events: events.events,
    enabled: body.enabled ?? true,
  });
  return NextResponse.json(
    { data: saved.config, signingSecret: saved.signingSecret },
    { status: saved.signingSecret ? 201 : 200, headers: NO_STORE },
  );
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  if (!developerStorageConfigured()) return NextResponse.json({ error: "Developer API storage is not configured" }, { status: 503 });
  const removed = await deleteWebhookConfig({ workspaceId: auth.session.tenantId, authUserId: auth.session.userId });
  return removed
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: "No webhook endpoint is configured" }, { status: 404 });
}

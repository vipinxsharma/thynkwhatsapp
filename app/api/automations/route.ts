import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { deleteRoutingRule, listRoutingRules, listRoutingRuns, saveRoutingRule } from "@/lib/automations/store";
import { matchRoutingRule, parseRoutingRule, RuleValidationError } from "@/lib/automations/routing";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof RuleValidationError ? error.message : "Automation storage is unavailable. Please contact your administrator." },
    { status: error instanceof RuleValidationError ? 400 : 503, headers: { "Cache-Control": "no-store" } });
}
export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  try {
    const [data, runs] = await Promise.all([listRoutingRules(auth.session.tenantId),listRoutingRuns(auth.session.tenantId)]);
    return NextResponse.json({ data, runs }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
async function mutate(request: NextRequest, update: boolean) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  try {
    let body;
    try { body = await request.json(); } catch { throw new RuleValidationError("Invalid JSON"); }
    if (!body || typeof body !== "object") throw new RuleValidationError("A rule is required");
    if (body.action === "test") {
      if (typeof body.text !== "string" || body.text.length > 65536 || typeof body.channelId !== "string") throw new RuleValidationError("Enter a test message and channel");
      const rules = await listRoutingRules(auth.session.tenantId);
      return NextResponse.json({ rule: matchRoutingRule(rules, body.text, body.channelId), simulation: true });
    }
    if (update && (typeof body.id !== "string" || !uuid.test(body.id))) throw new RuleValidationError("Invalid rule ID");
    const input = parseRoutingRule(body);
    const data = await saveRoutingRule(auth.session.tenantId, auth.session.userId, input, update ? body.id : undefined);
    return data ? NextResponse.json({ data }, { status: update ? 200 : 201 }) : NextResponse.json({ error: "Rule not found" }, { status: 404 });
  } catch (error) { return failure(error); }
}
export const POST = (request: NextRequest) => mutate(request, false);
export const PUT = (request: NextRequest) => mutate(request, true);
export async function DELETE(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!uuid.test(id)) return failure(new RuleValidationError("Invalid rule ID"));
  try {
    return await deleteRoutingRule(auth.session.tenantId,id) ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Rule not found" }, { status: 404 });
  } catch(error) { return failure(error); }
}

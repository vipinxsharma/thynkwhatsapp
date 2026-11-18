import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { isDurableInboxEnabled } from "@/lib/strapi/client";
import { endOfDayExclusive, leadsToCsv, parseDateOnly, type LeadSource } from "@/lib/leads/rules";
import { listLeads } from "@/lib/leads/store";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCES: LeadSource[] = ["interactive_button", "template_button"];
const LIST_LIMIT = 200;
const EXPORT_LIMIT = 10000;

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  if (!isDurableInboxEnabled()) {
    return NextResponse.json({ error: "Durable inbox storage is not configured" }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const sourceParam = params.get("source") || "";
  const stageParam = params.get("stageId") || "";
  const fromDate = params.get("from") ? parseDateOnly(params.get("from")) : null;
  const toDate = params.get("to") ? parseDateOnly(params.get("to")) : null;

  if (params.get("from") && !fromDate) return NextResponse.json({ error: "from must be YYYY-MM-DD" }, { status: 400 });
  if (params.get("to") && !toDate) return NextResponse.json({ error: "to must be YYYY-MM-DD" }, { status: 400 });
  if (sourceParam && !SOURCES.includes(sourceParam as LeadSource)) {
    return NextResponse.json({ error: "Unknown source" }, { status: 400 });
  }
  if (stageParam && !uuid.test(stageParam)) return NextResponse.json({ error: "Invalid stage" }, { status: 400 });

  const isExport = params.get("format") === "csv";
  const leads = await listLeads(auth.session.tenantId, {
    q: (params.get("q") || "").slice(0, 100),
    source: (sourceParam || undefined) as LeadSource | undefined,
    fromIso: fromDate ? `${fromDate}T00:00:00Z` : null,
    toIsoExclusive: toDate ? endOfDayExclusive(toDate) : null,
    stageId: stageParam || null,
    limit: isExport ? EXPORT_LIMIT : LIST_LIMIT,
  });

  if (isExport) {
    const csv = leadsToCsv(
      leads.map((lead) => ({
        name: lead.name,
        phoneNumber: lead.phoneNumber,
        stageName: lead.stageName,
        source: lead.source,
        campaignRef: lead.campaignRef,
        lastButtonText: lead.lastButtonText,
        tapCount: lead.tapCount,
        firstTappedAt: lead.firstTappedAt,
        lastTappedAt: lead.lastTappedAt,
      })),
    );
    const day = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${day}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({ data: leads, truncated: leads.length >= LIST_LIMIT });
}

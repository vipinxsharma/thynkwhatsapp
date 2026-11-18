import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { aiConfigured, assistDraft, type AssistDraft, type TemplateCategory } from "@/lib/templates/assist";

const noStore = { "Cache-Control": "no-store" };
const CATEGORIES: TemplateCategory[] = ["UTILITY", "MARKETING", "AUTHENTICATION"];

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/**
 * Reviews a draft template. It never submits anything to Meta: the caller decides
 * whether to apply the suggestion and then submits through /api/meta/templates.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null);
  const raw = body?.draft;
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "A draft is required" }, { status: 400, headers: noStore });
  }
  const draft: AssistDraft = {
    name: clean(raw.name, 512),
    category: CATEGORIES.includes(raw.category) ? raw.category : "UTILITY",
    language: clean(raw.language, 10) || "en_US",
    headerText: clean(raw.headerText, 200),
    bodyText: clean(raw.bodyText, 2000),
    footerText: clean(raw.footerText, 200),
    buttonType: raw.buttonType === "QUICK_REPLY" || raw.buttonType === "URL" ? raw.buttonType : "NONE",
    buttonText: clean(raw.buttonText, 80),
    buttonUrl: clean(raw.buttonUrl, 2000),
  };
  const rejectionReason = clean(body?.rejectionReason, 1000).trim() || undefined;
  try {
    const result = await assistDraft(draft, rejectionReason);
    return NextResponse.json({ data: { ...result, configured: aiConfigured() } }, { headers: noStore });
  } catch (error) {
    console.error("[Template Assist Error]", error);
    return NextResponse.json({ error: "The template helper is unavailable. Try again." }, { status: 503, headers: noStore });
  }
}

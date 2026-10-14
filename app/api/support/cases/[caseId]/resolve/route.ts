import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { aiInputHash, applyResolutionGate, generateAIResolution } from "@/lib/support/ai";
import {
  beginAIResolution,
  failAIResolution,
  finalizeAIResolution,
  getSupportCase,
  listSupportMessages,
  searchSupportKnowledge,
} from "@/lib/support/store";

type Context = { params: Promise<{ caseId: string }> };

export async function POST(request: NextRequest, context: Context) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  const { caseId } = await context.params;
  const caseItem = await getSupportCase(auth.session.tenantId, caseId);
  if (!caseItem) return NextResponse.json({ error: "Support case not found" }, { status: 404 });

  const messages = await listSupportMessages(auth.session.tenantId, caseId);
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const runId = await beginAIResolution({
    workspaceId: auth.session.tenantId,
    caseId,
    authUserId: auth.session.userId,
    model,
    inputHash: aiInputHash(caseItem, messages),
  });
  if (!runId) return NextResponse.json({ error: "Please wait before requesting another AI review" }, { status: 429 });

  try {
    const query = [caseItem.subject, ...messages.slice(-3).map((item) => item.body)].join(" ");
    const knowledge = await searchSupportKnowledge(auth.session.tenantId, query);
    const generated = await generateAIResolution({ caseItem, messages, knowledge });
    const gated = applyResolutionGate(generated.resolution, generated.allowedEvidenceIds);
    const message = await finalizeAIResolution({
      runId,
      workspaceId: auth.session.tenantId,
      caseItem,
      status: gated.status,
      category: gated.resolution.category,
      confidence: gated.resolution.confidence,
      answer: gated.resolution.answer,
      result: { ...gated.resolution, finalStatus: gated.status },
    });
    return NextResponse.json({ success: true, data: { message, status: gated.status } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "AI_UNKNOWN_ERROR";
    await failAIResolution(runId, auth.session.tenantId, code);
    if (code === "AI_NOT_CONFIGURED") {
      return NextResponse.json({ error: "AI assistance is not configured yet" }, { status: 503 });
    }
    return NextResponse.json({ error: "AI assistance could not complete this review" }, { status: 502 });
  }
}

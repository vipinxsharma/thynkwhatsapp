import { NextRequest, NextResponse } from "next/server";
import { apiError, withApiKey, type ApiErrorCode, readJsonObject } from "@/lib/developer/api-gateway";
import { isUuid, parseSendRequest } from "@/lib/developer/validation";
import { ensureContactConversation } from "@/lib/inbox/store";
import { sendWorkspaceMessage } from "@/lib/messaging/send-message";
import { isDurableInboxEnabled } from "@/lib/strapi/client";

/**
 * POST /api/v1/messages
 * Sends a text or approved template message to a WhatsApp number through the same path as the
 * dashboard, so the 24-hour window and the idempotent outbound ledger apply. Text is only accepted
 * inside the window. Outside it, send a template.
 */
export async function POST(request: NextRequest) {
  return withApiKey(request, async (context) => {
    const body = await readJsonObject(context.request);
    if (!body) return apiError(400, "invalid_json", "Request body must be a JSON object");

    const parsed = parseSendRequest(body);
    if (!parsed.ok) return apiError(400, "invalid_request", parsed.error);

    const idempotencyKey = context.request.headers.get("idempotency-key");
    if (!idempotencyKey || !isUuid(idempotencyKey)) {
      return apiError(400, "invalid_request",
        "Send an Idempotency-Key header containing a UUID. Reuse a key only to retry the same message.");
    }
    if (!isDurableInboxEnabled()) return apiError(503, "unavailable", "Message delivery is not configured on this server.");

    const value = parsed.value;
    const { conversation } = await ensureContactConversation({
      workspaceId: context.workspaceId,
      name: `+${value.to}`,
      phoneNumber: `+${value.to}`,
      tags: [],
    });

    const result = await sendWorkspaceMessage({
      workspaceId: context.workspaceId,
      actorAuthUserId: context.actor,
      idempotencyKey,
      body: {
        conversationId: conversation.id,
        recipientPhone: value.to,
        messageType: value.type,
        text: value.text,
        templateName: value.templateName,
        templateLanguage: value.templateLanguage,
        templateVariables: value.templateVariables,
      },
    });

    if (result.status === 200 && result.body.success === true) {
      const message = (result.body.data || {}) as Record<string, unknown>;
      return NextResponse.json({
        data: {
          id: message.id,
          wamId: message.wamId,
          conversationId: message.conversationId,
          type: message.type,
          status: message.status,
          timestamp: message.timestamp,
        },
      });
    }
    return fromSendFailure(result.status, result.body);
  });
}

function errorCodeFor(status: number, body: Record<string, unknown>): ApiErrorCode {
  if (body.error === "WINDOW_EXPIRED") return "outside_24h_window";
  if (status === 202) return "outcome_pending";
  if (status === 400) return "invalid_request";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 501 || status === 503) return "unavailable";
  return "internal_error";
}

function fromSendFailure(status: number, body: Record<string, unknown>): NextResponse {
  const message = typeof body.message === "string" ? body.message : String(body.error || "Message was not sent");
  return apiError(status, errorCodeFor(status, body), message);
}

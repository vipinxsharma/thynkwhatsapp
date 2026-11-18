import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/developer/api-key-store";
import { developerStorageConfigured } from "@/lib/developer/db";
import { isWellFormedApiKey, parseBearerToken } from "@/lib/developer/keys";
import { consumeApiKeyRateLimit } from "@/lib/developer/rate-limit";

export type ApiErrorCode =
  | "unauthorized"
  | "rate_limited"
  | "invalid_request"
  | "invalid_json"
  | "not_found"
  | "conflict"
  | "outside_24h_window"
  | "forbidden"
  | "outcome_pending"
  | "unavailable"
  | "internal_error";

/** Every error from /api/v1 uses this shape: `{ "error": { "code", "message" } }`. */
export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  headers: Record<string, string> = {},
): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

export interface ApiKeyContext {
  request: NextRequest;
  workspaceId: string;
  keyId: string;
  /** Recorded in outbound and audit rows in place of a user id. */
  actor: string;
}

/** Reads a JSON object body. Returns null for invalid JSON, arrays and other non-object values. */
export async function readJsonObject(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Authenticates the bearer key, applies the per-key rate limit and maps unexpected failures to a
 * JSON 500. The handler only runs for a valid, unrevoked, non-limited key.
 */
export async function withApiKey(
  request: NextRequest,
  handler: (context: ApiKeyContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  if (!developerStorageConfigured()) {
    return apiError(503, "unavailable", "The developer API is not configured on this server.");
  }
  try {
    const token = parseBearerToken(request.headers.get("authorization"));
    if (!token || !isWellFormedApiKey(token)) {
      return apiError(401, "unauthorized", "Send your API key as: Authorization: Bearer <key>");
    }
    const key = await authenticateApiKey(token);
    if (!key) return apiError(401, "unauthorized", "This API key is invalid or has been revoked.");

    const limit = await consumeApiKeyRateLimit(key.id);
    const rateHeaders = {
      "X-RateLimit-Limit": String(limit.limit),
      "X-RateLimit-Remaining": String(limit.remaining),
      "X-RateLimit-Reset": String(limit.resetAt),
    };
    if (!limit.allowed) {
      const retryAfter = Math.max(1, limit.resetAt - Math.floor(Date.now() / 1000));
      return apiError(429, "rate_limited", "Too many requests for this API key. Wait for the window to reset.", {
        ...rateHeaders,
        "Retry-After": String(retryAfter),
      });
    }

    const response = await handler({
      request,
      workspaceId: key.workspaceId,
      keyId: key.id,
      actor: `api_key:${key.id}`,
    });
    for (const [name, value] of Object.entries(rateHeaders)) response.headers.set(name, value);
    return response;
  } catch (error) {
    console.error("[Developer API Error]", error);
    return apiError(500, "internal_error", "Something went wrong. Try again.");
  }
}

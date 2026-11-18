import { developerDatabase } from "@/lib/developer/db";

export const API_KEY_RATE_LIMIT_PER_MINUTE = 60;
const WINDOW_MS = 60_000;

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix time in seconds when the current window ends. */
  resetAt: number;
}

/** Start of the fixed one-minute window that contains `now`. */
export function rateLimitWindowStart(now: Date): Date {
  return new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
}

/** Pure decision for a window that has already received `hits` requests, including this one. */
export function decideRateLimit(hits: number, now: Date, limit = API_KEY_RATE_LIMIT_PER_MINUTE): RateLimitDecision {
  const windowEnd = rateLimitWindowStart(now).getTime() + WINDOW_MS;
  return {
    allowed: hits <= limit,
    limit,
    remaining: Math.max(0, limit - hits),
    resetAt: Math.ceil(windowEnd / 1000),
  };
}

/** Counts one request against the key's current window. The count is shared by all instances. */
export async function consumeApiKeyRateLimit(
  keyId: string,
  now: Date = new Date(),
  limit: number = API_KEY_RATE_LIMIT_PER_MINUTE,
): Promise<RateLimitDecision> {
  const windowStart = rateLimitWindowStart(now);
  const rows = await developerDatabase().query(
    `INSERT INTO app_api_key_rate_windows (key_id, window_start, hits)
     VALUES ($1::uuid, $2::timestamptz, 1)
     ON CONFLICT (key_id, window_start) DO UPDATE SET hits = app_api_key_rate_windows.hits + 1
     RETURNING hits`,
    [keyId, windowStart.toISOString()],
  );
  const hits = Number((rows[0] as { hits: number | string } | undefined)?.hits ?? 1);
  if (hits === 1) {
    // First request of a new window: drop this key's counters older than an hour.
    await developerDatabase().query(
      `DELETE FROM app_api_key_rate_windows
       WHERE key_id = $1::uuid AND window_start < $2::timestamptz - interval '1 hour'`,
      [keyId, windowStart.toISOString()],
    );
  }
  return decideRateLimit(hits, now, limit);
}

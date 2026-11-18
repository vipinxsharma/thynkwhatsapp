import { MetaGraphClient } from "@/lib/meta/client";
import { listTokensToCheck, recordTokenError, recordTokenState } from "@/lib/meta/connections";

const DAY_MS = 24 * 60 * 60 * 1000;
// Refresh this long before expiry, so several daily runs can retry a failure.
export const REFRESH_WINDOW_DAYS = 14;

export interface TokenRefreshSummary {
  checked: number;
  refreshed: number;
  notDue: number;
  neverExpires: number;
  failed: number;
}

/**
 * Checks stored business tokens against Meta and refreshes the ones close to expiry.
 * A failure on one connection is recorded on that row and never stops the others.
 */
export async function refreshExpiringTokens(now: Date = new Date(), limit = 25): Promise<TokenRefreshSummary> {
  const windowEnd = new Date(now.getTime() + REFRESH_WINDOW_DAYS * DAY_MS);
  const summary: TokenRefreshSummary = { checked: 0, refreshed: 0, notDue: 0, neverExpires: 0, failed: 0 };

  for (const candidate of await listTokensToCheck(windowEnd, limit)) {
    summary.checked += 1;
    try {
      const client = new MetaGraphClient(candidate.accessToken);
      const state = await client.inspectToken();
      if (!state.isValid) {
        throw new Error("Meta reports this token as invalid or expired; the customer must reconnect the number");
      }
      if (!state.expiresAt) {
        await recordTokenState({ wabaId: candidate.wabaId, expiresAt: null });
        summary.neverExpires += 1;
        continue;
      }
      if (state.expiresAt > windowEnd) {
        await recordTokenState({ wabaId: candidate.wabaId, expiresAt: state.expiresAt });
        summary.notDue += 1;
        continue;
      }

      const newToken = await client.refreshBusinessToken();
      const refreshed = await new MetaGraphClient(newToken).inspectToken();
      if (!refreshed.isValid) throw new Error("Meta issued a token it does not report as valid");
      await recordTokenState({
        wabaId: candidate.wabaId,
        expiresAt: refreshed.expiresAt,
        newAccessToken: newToken,
      });
      summary.refreshed += 1;
    } catch (error) {
      summary.failed += 1;
      const message = error instanceof Error ? error.message : "Token refresh failed";
      console.error(`[Meta Token Refresh] WABA ${candidate.wabaId}: ${message}`);
      try {
        await recordTokenError(candidate.wabaId, message);
      } catch (recordError) {
        console.error("[Meta Token Refresh] Could not record the failure", recordError);
      }
    }
  }
  return summary;
}

// Pacing and automatic-pause rules for campaign sends. Everything here is a pure function so the
// decisions can be unit tested without a database or the Meta API.

/**
 * Sends per second allowed from one WhatsApp number. Meta's default cloud-API throughput is far
 * higher; 20/s leaves wide headroom so a campaign never looks like a burst to Meta.
 */
export const SENDS_PER_SECOND = 20;

/**
 * Sends allowed from one WhatsApp number in a rolling 24 hours. Meta limits business-initiated
 * conversations by unique recipient per 24 hours (250 for a new or unverified number, then tiers
 * of 1K, 10K and 100K as quality and volume allow). The repo does not read the current tier, so
 * the default is the starting tier. Attempts that Meta accepted or left uncertain count against it.
 */
export const DAILY_SEND_CAP = 250;
export const DAILY_WINDOW_HOURS = 24;

/** Quality ratings that pause sending. GREEN continues; an unknown or missing rating does not pause. */
export const PAUSING_QUALITY_RATINGS = ["YELLOW", "RED"] as const;

/** Meta error codes that mean "stop the whole campaign", not "this recipient failed". */
export const CAMPAIGN_LEVEL_CODES = new Set([
  4, 80007, 130429, 131048, 131056, // throughput, spam and pair rate limits
  131049, // message not delivered to keep the ecosystem healthy (quality signal)
  190, 10, 200, 131031, 131045, // token, permission, account locked, number not registered
  131042, // payment method problem
  132000, 132001, 132007, 132012, 132015, 132016, // template missing, paused, disabled or mismatched
]);

/** Minimum gap between two Meta send requests from one number, in milliseconds. */
export function minimumSendGapMs(sendsPerSecond: number = SENDS_PER_SECOND): number {
  if (!Number.isFinite(sendsPerSecond) || sendsPerSecond <= 0) throw new Error("sendsPerSecond must be positive");
  return Math.ceil(1000 / sendsPerSecond);
}

/** Milliseconds to wait before the next send so the per-second cap holds. 0 means send now. */
export function msUntilNextSend(lastSendAtMs: number | null, nowMs: number, sendsPerSecond: number = SENDS_PER_SECOND): number {
  if (lastSendAtMs === null) return 0;
  return Math.max(0, lastSendAtMs + minimumSendGapMs(sendsPerSecond) - nowMs);
}

/** How many more sends the rolling 24-hour cap allows right now. */
export function remainingDailyBudget(sendsInWindow: number, cap: number = DAILY_SEND_CAP): number {
  return Math.max(0, cap - Math.max(0, sendsInWindow));
}

/** Recipients to claim in one batch: the batch size, limited by what the daily cap still allows. */
export function batchClaimLimit(batchSize: number, dailyBudget: number): number {
  return Math.max(0, Math.min(batchSize, dailyBudget));
}

/** Returns the reason sending must pause for this quality rating, or null when it may continue. */
export function qualityPauseReason(rating: string | null | undefined, phoneNumberId: string): string | null {
  const normalised = (rating || "").trim().toUpperCase();
  if ((PAUSING_QUALITY_RATINGS as readonly string[]).includes(normalised)) {
    return `Sending paused: WhatsApp number ${phoneNumberId} has a ${normalised} quality rating. ` +
      "Improve the number's quality in Meta Business Manager, then resume the campaign yourself.";
  }
  return null;
}

/**
 * Returns the pause reason when a Meta send error means the whole campaign must stop: a
 * throughput or quality limit, or an error that affects every recipient. Null otherwise.
 */
export function campaignLevelPauseReason(input: { message: string; httpStatus: number; code: number | null }): string | null {
  if (input.httpStatus === 429 || (input.code !== null && CAMPAIGN_LEVEL_CODES.has(input.code))) {
    return `Sending paused: ${input.message}`;
  }
  return null;
}

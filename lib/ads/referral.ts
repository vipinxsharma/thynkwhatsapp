// Pure click-to-WhatsApp referral rules: no database or network access, so they can be unit tested directly.

/** Raw `referral` object as Meta sends it on an inbound message. Every field is untrusted until parsed here. */
export type AdReferralLike = {
  source_url?: unknown;
  source_type?: unknown;
  source_id?: unknown;
  headline?: unknown;
  body?: unknown;
  media_type?: unknown;
  ctwa_clid?: unknown;
};

export type AdReferral = {
  sourceType: "ad" | "post";
  sourceId: string;
  sourceUrl: string | null;
  headline: string;
  body: string;
  mediaType: string;
  ctwaClid: string | null;
};

const SOURCE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

/**
 * Reads the referral from an inbound message. Returns null when there is no referral, or when the
 * referral has no usable source (an unknown source type or a missing or malformed source id).
 * A source URL is kept only when it is https, so a stored link can never be a javascript: or data: URL.
 */
export function adReferralFromInbound(referral: AdReferralLike | undefined | null): AdReferral | null {
  if (!referral || typeof referral !== "object") return null;

  const sourceType = typeof referral.source_type === "string" ? referral.source_type.trim().toLowerCase() : "";
  if (sourceType !== "ad" && sourceType !== "post") return null;

  const rawId = typeof referral.source_id === "number" ? String(referral.source_id) : referral.source_id;
  const sourceId = typeof rawId === "string" ? rawId.trim() : "";
  if (!SOURCE_ID.test(sourceId)) return null;

  const sourceUrl = text(referral.source_url, 1000);
  const ctwaClid = text(referral.ctwa_clid, 512);

  return {
    sourceType,
    sourceId,
    sourceUrl: /^https:\/\//i.test(sourceUrl) ? sourceUrl : null,
    headline: text(referral.headline, 300),
    body: text(referral.body, 1000),
    mediaType: text(referral.media_type, 20),
    ctwaClid: ctwaClid || null,
  };
}

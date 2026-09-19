import crypto from "crypto";

/**
 * Validates the `x-hub-signature-256` header sent by Meta webhooks.
 *
 * Meta computes:
 * HMAC-SHA256(raw_body, META_APP_SECRET)
 * and transmits it as:
 * sha256=<hex_digest>
 *
 * @param rawBody - The untouched raw text/buffer of the incoming HTTP request body.
 * @param signatureHeader - The `x-hub-signature-256` header from Meta.
 * @param appSecret - The Meta App Secret configured for thynkWISE.
 * @returns boolean - True if the signature is authentic and untampered.
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string | undefined = process.env.META_APP_SECRET
): boolean {
  if (!signatureHeader || !appSecret) {
    return false;
  }

  const parts = signatureHeader.split("=");
  if (parts.length !== 2) {
    return false;
  }

  const [algorithm, expectedSignature] = parts;
  if (algorithm !== "sha256" || !expectedSignature) {
    return false;
  }

  try {
    const calculatedSignature = crypto
      .createHmac("sha256", appSecret)
      .update(rawBody, "utf8")
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const calculatedBuffer = Buffer.from(calculatedSignature, "utf8");

    // Timing-safe comparison to guard against timing attacks
    if (expectedBuffer.length !== calculatedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, calculatedBuffer);
  } catch (err) {
    console.error("[verifyMetaWebhookSignature Error]", err);
    return false;
  }
}

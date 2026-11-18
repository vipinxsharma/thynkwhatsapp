import crypto from "node:crypto";

// Cashfree signs webhooks as base64(HMAC-SHA256(clientSecret, timestamp + rawBody)).
// The raw body must be verified before it is parsed.
export function verifyCashfreeSignature(opts: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  secret: string;
}): boolean {
  if (!opts.timestamp || !opts.signature || !opts.secret) return false;
  const expected = crypto
    .createHmac("sha256", opts.secret)
    .update(opts.timestamp + opts.rawBody)
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(opts.signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

import { createHash, randomBytes } from "node:crypto";

// Pure helpers for developer API keys. Nothing here touches the database.

export const API_KEY_PREFIX = "xk_live_";
const SECRET_BYTES = 32;
// Visible part shown in key lists: the constant prefix plus the first 4 random characters.
const VISIBLE_RANDOM_CHARS = 4;

export interface GeneratedApiKey {
  /** Full key. Shown to the user exactly once, then never stored. */
  key: string;
  /** Visible part kept in plain text for identification, for example "xk_live_Ab3d". */
  prefix: string;
  /** SHA-256 hex digest of the full key. This is the only thing stored. */
  hash: string;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function generateApiKey(random: (size: number) => Buffer = randomBytes): GeneratedApiKey {
  const secret = random(SECRET_BYTES).toString("base64url");
  const key = `${API_KEY_PREFIX}${secret}`;
  return {
    key,
    prefix: `${API_KEY_PREFIX}${secret.slice(0, VISIBLE_RANDOM_CHARS)}`,
    hash: hashApiKey(key),
  };
}

export function isWellFormedApiKey(value: string): boolean {
  // base64url of 32 bytes is 43 characters.
  return new RegExp(`^${API_KEY_PREFIX}[A-Za-z0-9_-]{43}$`).test(value);
}

/** Returns the token from an `Authorization: Bearer <token>` header, or null. */
export function parseBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

export function neonAuthConfigured(): boolean {
  return Boolean(
    process.env.NEON_AUTH_BASE_URL &&
      process.env.NEON_AUTH_COOKIE_SECRET &&
      process.env.NEON_AUTH_COOKIE_SECRET.length >= 32
  );
}

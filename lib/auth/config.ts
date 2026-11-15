export function neonAuthConfigured(): boolean {
  return Boolean(
    process.env.NEON_AUTH_BASE_URL &&
      process.env.NEON_AUTH_COOKIE_SECRET &&
      process.env.NEON_AUTH_COOKIE_SECRET.length >= 32
  );
}

export function workspaceAccessConfigured(): boolean {
  return neonAuthConfigured() && Boolean(
    process.env.DATABASE_URL && process.env.AUTH_SESSION_SECRET &&
    process.env.AUTH_SESSION_SECRET.length >= 32
  );
}

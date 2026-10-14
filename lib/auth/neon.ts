import { createNeonAuth } from "@neondatabase/auth/next/server";
export { neonAuthConfigured } from "@/lib/auth/config";

export const neonAuth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL || "https://auth-not-configured.invalid/auth",
  cookies: {
    secret:
      process.env.NEON_AUTH_COOKIE_SECRET ||
      "configuration-required-cookie-secret-32-characters",
    sessionDataTtl: 300,
  },
  logLevel: process.env.NODE_ENV === "test" ? "silent" : "warn",
});

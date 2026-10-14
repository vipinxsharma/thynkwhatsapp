import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

export const SESSION_COOKIE_NAME = "thynkwise_session";

export type AppRole = "owner" | "admin" | "agent" | "viewer";

export interface AppSession {
  userId: string;
  email: string;
  tenantId: string;
  tenantName: string;
  role: AppRole;
}

interface SessionClaims {
  sub?: string;
  email?: string;
  tenantId?: string;
  tenantName?: string;
  role?: AppRole;
}

function getSessionSecret(): Uint8Array {
  const value = process.env.AUTH_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SESSION_SECRET must contain at least 32 characters");
  }
  return new TextEncoder().encode(value);
}

function isRole(value: unknown): value is AppRole {
  return ["owner", "admin", "agent", "viewer"].includes(String(value));
}

function claimsToSession(payload: SessionClaims): AppSession | null {
  if (
    !payload.sub ||
    !payload.email ||
    !payload.tenantId ||
    !payload.tenantName ||
    !isRole(payload.role)
  ) {
    return null;
  }

  return {
    userId: payload.sub,
    email: payload.email,
    tenantId: payload.tenantId,
    tenantName: payload.tenantName,
    role: payload.role,
  };
}

export async function createSessionToken(
  session: AppSession,
  expiresIn = "8h"
): Promise<string> {
  return new SignJWT({
    email: session.email,
    tenantId: session.tenantId,
    tenantName: session.tenantName,
    role: session.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(session.userId)
    .setIssuer("thynkwise-messaging-cloud")
    .setAudience("thynkwise-dashboard")
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string | undefined): Promise<AppSession | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify<SessionClaims>(token, getSessionSecret(), {
      issuer: "thynkwise-messaging-cloud",
      audience: "thynkwise-dashboard",
      algorithms: ["HS256"],
    });
    return claimsToSession(payload);
  } catch {
    return null;
  }
}

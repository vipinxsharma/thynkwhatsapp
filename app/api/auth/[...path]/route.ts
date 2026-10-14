import { neonAuth } from "@/lib/auth/neon";
import { neonAuthConfigured } from "@/lib/auth/config";

const handlers = neonAuth.handler();

function unavailable(): Response {
  return Response.json({ error: "Self-service authentication is not configured" }, { status: 503 });
}

type AuthHandler = typeof handlers.GET;

function guarded(handler: AuthHandler): AuthHandler {
  return async (request, context) => {
    if (!neonAuthConfigured()) return unavailable();
    return handler(request, context);
  };
}

export const GET = guarded(handlers.GET);
export const POST = guarded(handlers.POST);
export const PUT = guarded(handlers.PUT);
export const DELETE = guarded(handlers.DELETE);
export const PATCH = guarded(handlers.PATCH);

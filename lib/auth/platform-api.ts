import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, type AppSession } from "@/lib/auth/session";
import { isPlatformSuperadmin } from "@/lib/auth/platform-admin";

type PlatformApiAuth =
  | { ok: true; session: AppSession }
  | { ok: false; response: NextResponse };

// Fail closed: anyone who is not a verified platform superadmin gets a 404,
// so the platform routes do not reveal that they exist.
export async function requirePlatformApiSuperadmin(request: NextRequest): Promise<PlatformApiAuth> {
  const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });
  const auth = await requireApiSession(request);
  if (!auth.ok) return { ok: false, response: notFound() };
  if (!(await isPlatformSuperadmin(auth.session))) return { ok: false, response: notFound() };
  return { ok: true, session: auth.session };
}

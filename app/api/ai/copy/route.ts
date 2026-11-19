import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import {
  REPLY_MAX,
  describeProduct,
  improveReply,
  type DescribeProductInput,
  type ImproveReplyInput,
} from "@/lib/ai/copy";

const noStore = { "Cache-Control": "no-store" };
const MAX_PRICE_INR = 10_000_000;
const LANGUAGE_PATTERN = /^[a-z]{2}(-[A-Za-z]{2,8})?$/;

class InputError extends Error {}

function text(value: unknown, field: string, max: number, required: boolean): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (required) throw new InputError(`${field} is required`);
    return undefined;
  }
  if (typeof value !== "string") throw new InputError(`${field} must be text`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new InputError(`${field} is required`);
  if (trimmed.length > max) throw new InputError(`${field} must be ${max} characters or fewer`);
  return trimmed || undefined;
}

export function parseDescribeProduct(body: Record<string, unknown>): DescribeProductInput {
  const priceRaw = body.priceInr;
  let priceInr: number | undefined;
  if (priceRaw !== undefined && priceRaw !== null && priceRaw !== "") {
    priceInr = typeof priceRaw === "number" ? priceRaw : Number(priceRaw);
    if (!Number.isFinite(priceInr) || priceInr < 0 || priceInr > MAX_PRICE_INR) {
      throw new InputError(`priceInr must be between 0 and ${MAX_PRICE_INR}`);
    }
  }
  return {
    name: text(body.name, "name", 120, true) as string,
    priceInr,
    sku: text(body.sku, "sku", 64, false),
    notes: text(body.notes, "notes", 1000, false),
  };
}

export function parseImproveReply(body: Record<string, unknown>): ImproveReplyInput {
  const language = text(body.language, "language", 10, false);
  if (language && !LANGUAGE_PATTERN.test(language)) throw new InputError("language must be a code such as en or hi");
  return {
    text: text(body.text, "text", REPLY_MAX, true) as string,
    language,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["owner", "admin", "agent"]);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: noStore });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400, headers: noStore });
  }
  const record = body as Record<string, unknown>;

  try {
    if (record.action === "describe_product") {
      const data = await describeProduct(parseDescribeProduct(record));
      return NextResponse.json({ data }, { headers: noStore });
    }
    if (record.action === "improve_reply") {
      const data = await improveReply(parseImproveReply(record));
      return NextResponse.json({ data }, { headers: noStore });
    }
    return NextResponse.json(
      { error: 'action must be "describe_product" or "improve_reply"' },
      { status: 400, headers: noStore }
    );
  } catch (error) {
    if (error instanceof InputError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: noStore });
    }
    console.error("[AI Copy Error]", error);
    return NextResponse.json({ error: "AI writing help is unavailable right now" }, { status: 503, headers: noStore });
  }
}

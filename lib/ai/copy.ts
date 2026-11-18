// Writing help for product descriptions and WhatsApp reply wording.
// Rules always run first. A model may reword the result, but its output is rejected if it
// adds claims, prices or promises the user did not supply. Nothing here sends anything.

import { askModel } from "@/lib/ai/providers";

export type CopySource = "rules" | "openai" | "anthropic";

export interface CopyResult {
  text: string;
  issues: string[];
  source: CopySource;
}

export interface DescribeProductInput {
  name: string;
  priceInr?: number;
  sku?: string;
  notes?: string;
}

export interface ImproveReplyInput {
  text: string;
  language?: string;
}

export const DESCRIPTION_MAX = 400;
export const REPLY_MAX = 1000;

/** Words that assert something the user has not told us. Added only if the user typed them. */
const CLAIM_PATTERN = /\b(warrant(y|ies)|guarantee[ds]?|certified|certification|iso|discount|% ?off|sale|bestsell(er|ing)|in stock|out of stock|stock|free delivery|free shipping|cashback|lifetime|money[- ]back|approved|original|authentic|100%)\b/i;
const PROMISE_PATTERN = /\b(guarantee[ds]?|promise[ds]?|assure[ds]?|will (deliver|ship|arrive|refund)|by (tomorrow|today|tonight)|within \d+|immediately|right away|definitely)\b/i;

export function hasInventedClaim(output: string, source: string): boolean {
  const sourceLower = source.toLowerCase();
  const match = output.match(CLAIM_PATTERN) || output.match(PROMISE_PATTERN);
  if (!match) return false;
  return !sourceLower.includes(match[0].toLowerCase());
}

function hasNewNumbers(output: string, source: string): boolean {
  const plain = source.replace(/,/g, "");
  const numbers = output.match(/\d[\d,.]*/g) || [];
  return numbers.some((value) => !plain.includes(value.replace(/,/g, "")));
}

function clamp(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max - 1).trimEnd() + "…";
}

function formatPrice(priceInr?: number): string | null {
  if (priceInr === undefined || !Number.isFinite(priceInr)) return null;
  return `₹${priceInr.toLocaleString("en-IN")}`;
}

// ---------- describeProduct ----------

const DESCRIBE_SYSTEM = `You write short product descriptions for a WhatsApp catalogue.
Use ONLY the facts in the user message. Do not invent warranties, guarantees, discounts, offers, certifications, awards, stock levels, delivery promises, materials or sizes that are not given.
Keep it under ${DESCRIPTION_MAX} characters, plain and friendly, one short paragraph.
Reply with JSON only: {"description": "..."}`;

export function rulesDescribeProduct(input: DescribeProductInput): CopyResult {
  const issues: string[] = [];
  const parts: string[] = [input.name.trim()];
  const price = formatPrice(input.priceInr);
  if (price) parts.push(`Price ${price}.`);
  else issues.push("No price was given, so the description does not mention one.");
  const notes = (input.notes || "").replace(/\s+/g, " ").trim();
  if (notes) parts.push(notes);
  else issues.push("Add a few notes about the product for a fuller description.");
  if (input.sku) parts.push(`SKU ${input.sku.trim()}.`);

  let text = parts.join(" ");
  if (text.length > DESCRIPTION_MAX) {
    issues.push(`The description was shortened to ${DESCRIPTION_MAX} characters.`);
    text = clamp(text, DESCRIPTION_MAX);
  }
  return { text, issues, source: "rules" };
}

export async function describeProduct(input: DescribeProductInput): Promise<CopyResult> {
  const rules = rulesDescribeProduct(input);
  const facts = JSON.stringify({
    name: input.name,
    priceInr: input.priceInr ?? null,
    sku: input.sku ?? null,
    notes: input.notes ?? null,
  });
  const answer = await askModel({ system: DESCRIBE_SYSTEM, user: `Facts: ${facts}`, json: true });
  if (!answer) return rules;

  try {
    const parsed = JSON.parse(answer.text.slice(answer.text.indexOf("{"), answer.text.lastIndexOf("}") + 1)) as { description?: unknown };
    const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
    if (!description || description.length > DESCRIPTION_MAX) return rules;
    const source = `${facts} ${input.name} ${input.notes ?? ""} ${input.sku ?? ""}`;
    if (hasInventedClaim(description, source)) {
      return { ...rules, issues: [...rules.issues, "The AI wording added a claim that was not in your facts, so the plain description is shown."] };
    }
    if (hasNewNumbers(description, source)) return rules;
    return { text: description, issues: rules.issues, source: answer.source };
  } catch {
    return rules;
  }
}

// ---------- improveReply ----------

const REPLY_SYSTEM = `You rewrite a WhatsApp customer reply to be clearer and polite.
Keep the same meaning. Do not add promises, prices, dates, discounts or commitments that are not in the original. Do not add or change any numbers.
Keep it under ${REPLY_MAX} characters.
Reply with JSON only: {"text": "..."}`;

const GREETING = /^(hi|hello|hey|namaste|good (morning|afternoon|evening)|dear|greetings)\b/i;

export function rulesImproveReply(input: ImproveReplyInput): CopyResult {
  const original = input.text;
  const issues: string[] = [];
  const trimmed = original.trim();
  if (original.length > REPLY_MAX) issues.push(`The reply is longer than ${REPLY_MAX} characters. Shorten it before sending.`);
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 8 && letters === letters.toUpperCase()) issues.push("The reply is all capitals, which can read as shouting. Use normal case.");
  const language = (input.language || "en").toLowerCase();
  if (language.startsWith("en") && trimmed && !GREETING.test(trimmed)) issues.push("Start with a greeting such as “Hello” so the reply feels personal.");
  if (!trimmed) issues.push("The reply is empty.");
  return { text: original, issues, source: "rules" };
}

export async function improveReply(input: ImproveReplyInput): Promise<CopyResult> {
  const rules = rulesImproveReply(input);
  if (!rules.text.trim()) return rules;
  const answer = await askModel({
    system: REPLY_SYSTEM,
    user: `Language: ${input.language || "en"}\nOriginal reply: ${JSON.stringify(input.text)}`,
    json: true,
  });
  if (!answer) return rules;

  try {
    const parsed = JSON.parse(answer.text.slice(answer.text.indexOf("{"), answer.text.lastIndexOf("}") + 1)) as { text?: unknown };
    const improved = typeof parsed.text === "string" ? parsed.text.trim() : "";
    if (!improved || improved.length > REPLY_MAX) return rules;
    if (PROMISE_PATTERN.test(improved) && !PROMISE_PATTERN.test(input.text)) return rules;
    if (hasNewNumbers(improved, input.text)) return rules;
    if (/[₹$€£]/.test(improved) && !/[₹$€£]/.test(input.text)) return rules;
    return { text: improved, issues: rules.issues, source: answer.source };
  } catch {
    return rules;
  }
}

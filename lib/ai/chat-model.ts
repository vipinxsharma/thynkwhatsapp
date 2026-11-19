import { MAX_AI_REPLY_LENGTH, type ReplyDecision } from "./chat";

/**
 * Optional paraphrase step. OpenAI first (OPENAI_API_KEY), Claude as fallback
 * (ANTHROPIC_API_KEY). The model sees only the FAQ or catalogue text it is given and may only
 * rephrase it. Any failure, low confidence, or output that adds numbers, links or currency
 * symbols keeps the rules text, or hands over.
 */

export interface ModelDraft {
  confident: boolean;
  reply: string;
}

type FetchLike = typeof fetch;

const SYSTEM_PROMPT = `You rewrite a business's own answer for a WhatsApp customer.
Rules:
- Use only the facts in SOURCE. Do not add prices, discounts, promises, policies, dates, or contact details that are not in SOURCE.
- Keep numbers, currency and links exactly as written in SOURCE.
- If SOURCE does not clearly answer the customer's message, set confident to false.
Reply with JSON only: {"confident": true|false, "reply": "..."}. Keep reply under 600 characters.`;

function buildUserPrompt(inboundText: string, source: string): string {
  return `CUSTOMER MESSAGE: ${JSON.stringify(inboundText.slice(0, 500))}\nSOURCE: ${JSON.stringify(source)}`;
}

async function askOpenAI(prompt: string, fetchImpl: FetchLike): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? null;
}

async function askAnthropic(prompt: string, fetchImpl: FetchLike): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_CHAT_MODEL || "claude-haiku-5-5",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
  return data.content?.find((part) => part.type === "text")?.text ?? null;
}

/** Parses the model's JSON. Returns null for anything that is not the expected shape. */
export function parseModelDraft(raw: string | null): ModelDraft | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(raw.slice(start, end + 1)) as { confident?: unknown; reply?: unknown };
    if (typeof value.confident !== "boolean" || typeof value.reply !== "string") return null;
    return { confident: value.confident, reply: value.reply.trim() };
  } catch {
    return null;
  }
}

/** Calls OpenAI, then Claude. Returns null when neither provider answers usably. */
export async function requestModelDraft(
  inboundText: string,
  source: string,
  fetchImpl: FetchLike = fetch,
): Promise<ModelDraft | null> {
  const prompt = buildUserPrompt(inboundText, source);
  try {
    const openai = parseModelDraft(await askOpenAI(prompt, fetchImpl));
    if (openai) return openai;
  } catch {
    // Fall through to the backup provider.
  }
  try {
    return parseModelDraft(await askAnthropic(prompt, fetchImpl));
  } catch {
    return null;
  }
}

const NUMBER_PATTERN = /\d+(?:[.,]\d+)*/g;
const FORBIDDEN_SYMBOLS = ["₹", "$", "€", "£", "%", "@", "http", "www."];

/**
 * A paraphrase may not introduce a number, currency symbol, link or email that the source
 * does not already contain.
 */
export function paraphraseIsSafe(reply: string, source: string): boolean {
  if (!reply || reply.length > MAX_AI_REPLY_LENGTH) return false;
  const lowerReply = reply.toLocaleLowerCase("en-US");
  const lowerSource = source.toLocaleLowerCase("en-US");
  for (const symbol of FORBIDDEN_SYMBOLS) {
    if (lowerReply.includes(symbol) && !lowerSource.includes(symbol)) return false;
  }
  const sourceNumbers = new Set(source.match(NUMBER_PATTERN) ?? []);
  for (const number of reply.match(NUMBER_PATTERN) ?? []) {
    if (!sourceNumbers.has(number)) return false;
  }
  return true;
}

/**
 * Applies the optional model step to a rules decision. Only a "send" decision is refined.
 * On any failure the rules decision stands.
 */
export async function decideWithModel(
  decision: ReplyDecision,
  inboundText: string,
  fetchImpl: FetchLike = fetch,
): Promise<ReplyDecision> {
  if (decision.action !== "send") return decision;
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) return decision;

  const draft = await requestModelDraft(inboundText, decision.text, fetchImpl);
  if (!draft) return decision;
  if (!draft.confident) {
    return { action: "handover", reason: "model was not confident in the FAQ or catalogue text" };
  }
  if (!paraphraseIsSafe(draft.reply, decision.text)) return decision;
  return { ...decision, text: draft.reply, reason: `${decision.reason}; model paraphrase` };
}

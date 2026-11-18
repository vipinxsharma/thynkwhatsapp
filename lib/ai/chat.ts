/**
 * Pure policy for AI replies to inbound WhatsApp text. No I/O in this file.
 *
 * The reply text is always a verbatim FAQ answer or catalogue description supplied by the
 * workspace. The model step (./chat-model.ts) may only paraphrase that text, and it is
 * optional: the rules decision wins on any failure.
 */

export type ConversationStatus = "open" | "pending" | "closed";

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface CatalogHit {
  name: string;
  /** Description text the workspace wrote for the product. Quoted as-is. */
  text: string;
}

export interface DecideReplyInput {
  inboundText: string;
  conversationStatus: ConversationStatus;
  windowOpen: boolean;
  aiEnabled: boolean;
  /** True when the sender opted out (STOP words or a recorded opt-out). */
  optOut: boolean;
  faq: FaqEntry[];
  catalogHits: CatalogHit[];
}

export type ReplyDecision =
  | { action: "send"; text: string; reason: string; source: "faq" | "catalogue" }
  | { action: "handover"; reason: string }
  | { action: "ignore"; reason: string };

export const MAX_AI_REPLY_LENGTH = 1000;
export const MAX_FAQ_TEXT_LENGTH = 4000;

const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "optout", "opt out", "remove me", "stop all"]);

/** Same rule as the campaign opt-out check: the whole message is a STOP word, case-insensitive. */
export function isOptOutText(text: string): boolean {
  return STOP_WORDS.has(normalize(text).trim());
}

const HUMAN_STEMS = ["human", "agent", "person", "representative", "manager", "supervisor", "talk", "speak", "callback"];
const MONEY_STEMS = ["refund", "pay", "paid", "charg", "invoice", "bill", "money", "price", "cost", "deduct", "emi", "loan", "cash", "upi", "transaction", "rupee", "rs", "inr", "usd", "amount"];
const COMPLAINT_STEMS = ["complain", "angry", "furious", "worst", "terrible", "horrible", "unacceptable", "disappoint", "scam", "fraud", "cheat", "useless", "rude", "broken", "waste"];
const LEGAL_STEMS = ["legal", "lawyer", "lawsuit", "sue", "court", "police", "attorney", "consumer", "forum"];
const HEALTH_STEMS = ["health", "medic", "doctor", "hospital", "symptom", "pain", "allerg", "pregnan", "disease", "injur", "emergenc", "prescri", "diagnos", "covid", "dose"];

const SENSITIVE_SYMBOLS = ["₹", "$", "€", "£"];

export function normalize(text: string): string {
  return text.toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function tokensOf(text: string): string[] {
  return normalize(text).split(/\s+/).filter(Boolean);
}

function matchesStem(tokens: string[], stems: string[]): boolean {
  return tokens.some((token) => stems.some((stem) => token.startsWith(stem)));
}

/**
 * Returns the reason a message must go to a person, or null. Stems are prefix matches on
 * purpose: a false positive hands over to a human, which is the safe direction.
 */
export function handoverReason(text: string): string | null {
  const tokens = tokensOf(text);
  if (matchesStem(tokens, HUMAN_STEMS)) return "asks for a human";
  if (matchesStem(tokens, MONEY_STEMS) || SENSITIVE_SYMBOLS.some((symbol) => text.includes(symbol))) return "mentions money";
  if (matchesStem(tokens, COMPLAINT_STEMS)) return "complaint";
  if (matchesStem(tokens, LEGAL_STEMS)) return "legal matter";
  if (matchesStem(tokens, HEALTH_STEMS)) return "health matter";
  return null;
}

const STOPWORDS = new Set([
  "the", "and", "for", "you", "are", "with", "this", "that", "what", "how", "can", "does", "have", "has",
  "your", "our", "its", "there", "any", "please", "hello", "hey", "want", "need", "about", "get", "will",
  "when", "where", "which", "who", "why", "would", "could", "tell", "know", "some", "from", "they", "them",
]);

function meaningfulTokens(text: string): Set<string> {
  return new Set(tokensOf(text).filter((token) => token.length >= 3 && !STOPWORDS.has(token)));
}

/** Confident only when the question shares real vocabulary with the entry. */
function overlapScore(question: Set<string>, entry: Set<string>): number {
  let shared = 0;
  for (const token of question) if (entry.has(token)) shared += 1;
  return shared;
}

function isConfident(shared: number, questionSize: number): boolean {
  if (shared === 0) return false;
  return shared >= 2 || shared / Math.max(questionSize, 1) >= 0.5;
}

export function bestFaqMatch(text: string, faq: FaqEntry[]): FaqEntry | null {
  const question = meaningfulTokens(text);
  let best: { entry: FaqEntry; shared: number } | null = null;
  for (const entry of faq) {
    const shared = overlapScore(question, meaningfulTokens(entry.question));
    if (!best || shared > best.shared) best = { entry, shared };
  }
  if (!best || !isConfident(best.shared, question.size)) return null;
  return best.entry;
}

export function bestCatalogMatch(text: string, hits: CatalogHit[]): CatalogHit | null {
  const question = meaningfulTokens(text);
  let best: { hit: CatalogHit; shared: number } | null = null;
  for (const hit of hits) {
    const shared = overlapScore(question, meaningfulTokens(`${hit.name} ${hit.text}`));
    if (!best || shared > best.shared) best = { hit, shared };
  }
  if (!best || !isConfident(best.shared, question.size)) return null;
  return best.hit;
}

function capReply(text: string): string {
  return text.trim().slice(0, MAX_AI_REPLY_LENGTH);
}

/**
 * Rules, in order:
 * 1. AI off, closed conversation, or opted-out sender: ignore.
 * 2. Window closed: hand over.
 * 3. Human request, money, complaint, legal or health words: hand over.
 * 4. A confident FAQ match, then a confident catalogue match: send that text.
 * 5. Otherwise: hand over.
 */
export function decideReply(input: DecideReplyInput): ReplyDecision {
  if (!input.aiEnabled) return { action: "ignore", reason: "AI replies are off" };
  if (input.conversationStatus === "closed") return { action: "ignore", reason: "conversation is closed" };
  if (input.optOut || isOptOutText(input.inboundText)) return { action: "ignore", reason: "sender opted out" };
  if (!input.windowOpen) return { action: "handover", reason: "24-hour window is closed" };

  const sensitive = handoverReason(input.inboundText);
  if (sensitive) return { action: "handover", reason: sensitive };

  const faq = bestFaqMatch(input.inboundText, input.faq);
  if (faq) return { action: "send", text: capReply(faq.answer), reason: "confident FAQ match", source: "faq" };

  const catalogue = bestCatalogMatch(input.inboundText, input.catalogHits);
  if (catalogue) {
    return { action: "send", text: capReply(catalogue.text), reason: "confident catalogue match", source: "catalogue" };
  }

  return { action: "handover", reason: "no confident answer in FAQ or catalogue" };
}

/** Parses the FAQ text. Entries are "Q: question" followed by "A: answer" lines; blank lines are ignored. */
export function parseFaqText(faqText: string | null | undefined): FaqEntry[] {
  if (!faqText) return [];
  const entries: Array<{ question: string; answer: string[] }> = [];
  let current: { question: string; answer: string[] } | null = null;
  let inAnswer = false;
  for (const raw of faqText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const q = /^Q:\s*(.*)$/i.exec(line);
    const a = /^A:\s*(.*)$/i.exec(line);
    if (q) {
      current = { question: q[1].trim(), answer: [] };
      entries.push(current);
      inAnswer = false;
    } else if (a && current) {
      current.answer.push(a[1].trim());
      inAnswer = true;
    } else if (current && inAnswer) {
      current.answer.push(line);
    }
  }
  return entries
    .map((entry) => ({ question: entry.question, answer: entry.answer.join(" ").trim() }))
    .filter((entry) => entry.question && entry.answer);
}

export interface AiChatSettingsInput {
  enabled: boolean;
  faqText: string | null;
  handoverContact: string | null;
}

/** Validates the settings request body. Throws an Error with a user-facing message. */
export function validateAiChatSettings(body: unknown): AiChatSettingsInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Settings are required");
  const value = body as Record<string, unknown>;
  if (typeof value.enabled !== "boolean") throw new Error("enabled must be true or false");
  const faq = value.faq_text ?? null;
  if (faq !== null && typeof faq !== "string") throw new Error("faq_text must be text");
  const faqText = typeof faq === "string" && faq.trim() ? faq.trim() : null;
  if (faqText && faqText.length > MAX_FAQ_TEXT_LENGTH) {
    throw new Error(`faq_text must be ${MAX_FAQ_TEXT_LENGTH} characters or fewer`);
  }
  const contact = value.handover_contact ?? null;
  if (contact !== null && typeof contact !== "string") throw new Error("handover_contact must be text");
  const handoverContact = typeof contact === "string" && contact.trim() ? contact.trim() : null;
  if (handoverContact && handoverContact.length > 200) throw new Error("handover_contact must be 200 characters or fewer");
  return { enabled: value.enabled, faqText, handoverContact };
}

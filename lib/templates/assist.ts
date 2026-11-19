// AI-assisted WhatsApp template review. Nothing here sends anything to Meta: it only
// suggests a category, flags likely problems, and proposes wording the user can accept.

export type TemplateCategory = "UTILITY" | "MARKETING" | "AUTHENTICATION";

export interface AssistDraft {
  name: string;
  category: TemplateCategory;
  language: string;
  headerText?: string;
  bodyText: string;
  footerText?: string;
  buttonType?: "NONE" | "QUICK_REPLY" | "URL";
  buttonText?: string;
  buttonUrl?: string;
}

export interface AssistIssue {
  severity: "error" | "warning";
  message: string;
}

export interface AssistResult {
  suggestedCategory: TemplateCategory;
  categoryReasons: string[];
  issues: AssistIssue[];
  suggestion: {
    headerText?: string;
    bodyText?: string;
    footerText?: string;
    fixNotes?: string[];
  } | null;
  source: "rules" | "openai" | "anthropic";
}

const MARKETING_WORDS = /\b(offer|sale|discount|% ?off|deal|limited|exclusive|buy now|shop now|free|save|promo|new arrival|don'?t miss|hurry|coupon)\b/i;
const UTILITY_WORDS = /\b(order|receipt|invoice|shipment|shipped|delivery|appointment|booking|payment|account|reference|ticket|confirm(ed|ation)?|renewal due|balance|statement)\b/i;
const AUTH_WORDS = /\b(otp|one[- ]time (password|code)|verification code|login code|passcode)\b/i;

/** Meta's rejection reasons are free text; these hints cover the causes seen most often. */
const REJECTION_HINTS: Array<{ match: RegExp; hint: string }> = [
  { match: /variable|placeholder|parameter|example/i, hint: "Give a realistic example value for every {{n}} variable, and keep the numbering 1, 2, 3 without gaps." },
  { match: /promotional|marketing|category/i, hint: "The wording reads as promotion. Either move the template to Marketing, or remove sales language and keep only the transaction details." },
  { match: /url|link|button/i, hint: "Use one complete https link. Do not put variables inside the link, and keep the button text short and plain." },
  { match: /header/i, hint: "Keep the header short, plain text, and do not use variables in it unless Meta asks for an example." },
  { match: /footer/i, hint: "Keep the footer to a short plain line with no links or variables." },
  { match: /spam|policy|prohibit|sensitive/i, hint: "The content may break Meta's messaging policy. Remove urgency pressure, unverified claims and anything that asks for personal or payment details." },
  { match: /name/i, hint: "Use lowercase letters, numbers and underscores only for the template name, and make it unique for this language." },
];

export function checkDraft(draft: AssistDraft): AssistResult {
  const body = draft.bodyText || "";
  const combined = [draft.headerText, body, draft.footerText, draft.buttonText].filter(Boolean).join(" ");
  const issues: AssistIssue[] = [];
  const reasons: string[] = [];

  const marketingHit = MARKETING_WORDS.test(combined);
  const utilityHit = UTILITY_WORDS.test(combined);
  const authHit = AUTH_WORDS.test(combined);
  let suggested: TemplateCategory;
  if (authHit) {
    suggested = "AUTHENTICATION";
    reasons.push("Mentions a one-time code, so it fits the Authentication category.");
  } else if (marketingHit && !utilityHit) {
    suggested = "MARKETING";
    reasons.push("Uses promotional wording and no transaction details, so it fits Marketing.");
  } else if (utilityHit && !marketingHit) {
    suggested = "UTILITY";
    reasons.push("Reports a transaction or account event, so it fits Utility.");
  } else if (marketingHit && utilityHit) {
    suggested = "MARKETING";
    reasons.push("Mixes transaction details with promotional wording. Meta reviews this as Marketing, so treat it as Marketing.");
  } else {
    suggested = "UTILITY";
    reasons.push("No clear promotional or code wording was found, so Utility is the lower-risk choice.");
  }

  if (draft.category !== suggested) {
    issues.push({
      severity: draft.category === "UTILITY" && marketingHit ? "error" : "warning",
      message: `The category is ${draft.category}, but the wording looks like ${suggested}. Meta may reclassify it or reject it.`,
    });
  }
  if (draft.category === "UTILITY" && marketingHit) {
    issues.push({ severity: "error", message: "Promotional wording in a Utility template is a common rejection. Remove the sales language or change the category." });
  }
  if (!/^[a-z0-9_]{1,512}$/.test(draft.name || "")) {
    issues.push({ severity: "error", message: "Template name may use only lowercase letters, numbers and underscores." });
  }
  if (!body.trim()) issues.push({ severity: "error", message: "The body text is required." });
  if (body.length > 1024) issues.push({ severity: "error", message: "The body is longer than 1024 characters." });
  if (draft.headerText && draft.headerText.length > 60) issues.push({ severity: "error", message: "The header is longer than 60 characters." });
  if (draft.footerText && draft.footerText.length > 60) issues.push({ severity: "error", message: "The footer is longer than 60 characters." });
  if (/\{\{\s*(?!\d+\s*\})[^}]*\}\}/.test(body)) {
    issues.push({ severity: "error", message: "Variables must be numbered like {{1}}, {{2}}. Named variables are not supported." });
  }
  const numbers = [...new Set((body.match(/\{\{(\d+)\}\}/g) || []).map((item) => Number(item.replace(/\D/g, ""))))].sort((a, b) => a - b);
  if (numbers.length > 0 && numbers.some((value, index) => value !== index + 1)) {
    issues.push({ severity: "error", message: "Variable numbers must run 1, 2, 3 without gaps." });
  }
  if (numbers.length > 0) {
    issues.push({ severity: "warning", message: "Add a realistic sample value for each variable before submitting, or Meta may reject the template." });
  }
  if (draft.buttonType === "URL" && /\{\{/.test(draft.buttonUrl || "")) {
    issues.push({ severity: "error", message: "A URL button cannot contain a variable in this flow." });
  }
  if (/https?:\/\//i.test(body) && draft.category === "AUTHENTICATION") {
    issues.push({ severity: "error", message: "Authentication templates should not include links." });
  }

  return { suggestedCategory: suggested, categoryReasons: reasons, issues, suggestion: null, source: "rules" };
}

/** Plain-language hints for a Meta rejection reason pasted by the user. */
export function rejectionHints(reason: string): string[] {
  const hints = REJECTION_HINTS.filter((item) => item.match.test(reason)).map((item) => item.hint);
  return hints.length > 0 ? hints : ["Meta did not name the cause. Shorten the wording, remove sales language and variables, and resubmit."];
}

const SYSTEM_PROMPT = `You help a business write WhatsApp message templates that Meta will approve.
Categories: UTILITY (transaction or account updates), MARKETING (promotions, offers, re-engagement), AUTHENTICATION (one-time codes only).
Rules: variables are {{1}}, {{2}} with no gaps; no promotional language in Utility; no links in Authentication; header max 60 characters; footer max 60 characters; body max 1024 characters.
Reply with JSON only, shaped as {"suggestedCategory": "...", "categoryReasons": ["..."], "issues": [{"severity": "error|warning", "message": "..."}], "suggestion": {"headerText": "...", "bodyText": "...", "footerText": "...", "fixNotes": ["..."]}}. Keep the business's meaning; do not invent offers, prices or claims.`;

export function buildPrompt(draft: AssistDraft, rejectionReason?: string): string {
  return [
    `Draft: ${JSON.stringify({ category: draft.category, header: draft.headerText, body: draft.bodyText, footer: draft.footerText, button: draft.buttonText })}`,
    rejectionReason ? `Meta rejected this template with: "${rejectionReason}". Propose a corrected version that addresses it.` : "Check the draft and suggest the category.",
  ].join("\n");
}

function parseModelJson(text: string): Omit<AssistResult, "source"> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1)) as Partial<AssistResult>;
    const category = value.suggestedCategory;
    if (category !== "UTILITY" && category !== "MARKETING" && category !== "AUTHENTICATION") return null;
    const issues = Array.isArray(value.issues)
      ? value.issues.filter((item) => item && typeof item.message === "string").map((item) => ({
          severity: item.severity === "error" ? "error" as const : "warning" as const,
          message: String(item.message).slice(0, 300),
        })).slice(0, 12)
      : [];
    return {
      suggestedCategory: category,
      categoryReasons: Array.isArray(value.categoryReasons) ? value.categoryReasons.map(String).slice(0, 5) : [],
      issues,
      suggestion: value.suggestion && typeof value.suggestion === "object" ? {
        headerText: value.suggestion.headerText ? String(value.suggestion.headerText).slice(0, 60) : undefined,
        bodyText: value.suggestion.bodyText ? String(value.suggestion.bodyText).slice(0, 1024) : undefined,
        footerText: value.suggestion.footerText ? String(value.suggestion.footerText).slice(0, 60) : undefined,
        fixNotes: Array.isArray(value.suggestion.fixNotes) ? value.suggestion.fixNotes.map(String).slice(0, 6) : undefined,
      } : null,
    };
  } catch {
    return null;
  }
}

async function askOpenAI(prompt: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_TEMPLATE_MODEL || "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? null;
}

async function askAnthropic(prompt: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_TEMPLATE_MODEL || "claude-haiku-5-5",
      max_tokens: 900,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
  return data.content?.find((part) => part.type === "text")?.text ?? null;
}

/**
 * Rules always run. If an OpenAI key is set it is asked first; if that is missing or fails,
 * the Claude key is asked. A failed or unusable model answer falls back to the rules alone.
 */
export async function assistDraft(draft: AssistDraft, rejectionReason?: string): Promise<AssistResult> {
  const rules = checkDraft(draft);
  const prompt = buildPrompt(draft, rejectionReason);
  const attempts: Array<{ source: "openai" | "anthropic"; call: () => Promise<string | null> }> = [
    { source: "openai", call: () => askOpenAI(prompt) },
    { source: "anthropic", call: () => askAnthropic(prompt) },
  ];
  for (const attempt of attempts) {
    let text: string | null = null;
    try {
      text = await attempt.call();
    } catch {
      text = null;
    }
    const parsed = text ? parseModelJson(text) : null;
    if (parsed) {
      const mergedIssues = [...rules.issues, ...parsed.issues.filter((item) => !rules.issues.some((existing) => existing.message === item.message))];
      return { ...parsed, issues: mergedIssues, source: attempt.source };
    }
  }
  if (rejectionReason) {
    return { ...rules, suggestion: { fixNotes: rejectionHints(rejectionReason) }, source: "rules" };
  }
  return rules;
}

export function aiConfigured(): { openai: boolean; anthropic: boolean } {
  return { openai: Boolean(process.env.OPENAI_API_KEY), anthropic: Boolean(process.env.ANTHROPIC_API_KEY) };
}

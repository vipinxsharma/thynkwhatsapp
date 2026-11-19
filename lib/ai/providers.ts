// Shared model caller for the AI writing helpers. OpenAI is asked first, Claude is the backup.
// Keys are read from the environment only and are never logged. Nothing here throws.

export type ModelSource = "openai" | "anthropic";

export interface ModelAnswer {
  source: ModelSource;
  text: string;
}

export interface AskModelInput {
  system: string;
  user: string;
  /** Ask for a JSON object. OpenAI is put in JSON mode; Claude is told by the system prompt. */
  json?: boolean;
}

const TIMEOUT_MS = 15_000;

export function aiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

async function callOpenAI(input: AskModelInput): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
      temperature: 0.3,
      ...(input.json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? null;
}

async function callAnthropic(input: AskModelInput): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_TEXT_MODEL || "claude-haiku-5-5",
      max_tokens: 800,
      system: input.system,
      messages: [{ role: "user", content: input.user }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
  return data.content?.find((part) => part.type === "text")?.text ?? null;
}

/**
 * Tries OpenAI, then Claude. Returns the first non-empty text, tagged with its source,
 * or null when no key is set or both providers fail. Never throws.
 */
export async function askModel(input: AskModelInput): Promise<ModelAnswer | null> {
  const attempts: Array<{ source: ModelSource; call: () => Promise<string | null> }> = [
    { source: "openai", call: () => callOpenAI(input) },
    { source: "anthropic", call: () => callAnthropic(input) },
  ];
  for (const attempt of attempts) {
    try {
      const text = await attempt.call();
      if (text && text.trim()) return { source: attempt.source, text };
    } catch {
      // Network error or timeout: try the next provider.
    }
  }
  return null;
}

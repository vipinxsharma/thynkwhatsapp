import crypto from "node:crypto";
import type { SupportCase, SupportMessage } from "@/lib/support/store";

export type ResolutionCategory =
  | "product_guidance"
  | "integration_diagnostics"
  | "deliverability"
  | "billing"
  | "security"
  | "compliance"
  | "account_restriction"
  | "unknown";

export interface KnowledgeItem {
  id: string;
  title: string;
  body: string;
}

export interface AIResolution {
  category: ResolutionCategory;
  outcome: "answer" | "needs_customer" | "escalate";
  confidence: number;
  answer: string;
  evidence: string[];
}

export type ResolutionStatus = "auto_resolved" | "awaiting_customer" | "escalated";

const HIGH_RISK_CATEGORIES = new Set<ResolutionCategory>([
  "billing",
  "security",
  "compliance",
  "account_restriction",
]);

const BUILTIN_KNOWLEDGE: KnowledgeItem[] = [
  {
    id: "delivery-evidence-gates",
    title: "Delivery evidence gates",
    body: "A submitted API request is not proof of delivery. Confirm provider acceptance and webhook delivery or read events separately. Never claim that a deployment, provider change, message, payment, or account review succeeded without source-system evidence.",
  },
  {
    id: "meta-account-boundaries",
    title: "Meta account boundaries",
    body: "Business verification, WABA restrictions, number ownership, display-name review, and Tech Provider access are separate Meta-controlled states. The assistant may explain checks but must escalate restrictions, ownership conflicts, compliance decisions, and review requests to a human or Meta support.",
  },
];

export function redactSensitiveText(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk|key|token|secret)[-_][A-Za-z0-9_-]{12,}\b/gi, "[REDACTED_SECRET]")
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_TOKEN]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/(?<!\d)(?:\+?\d[\s-]?){9,14}\d(?!\d)/g, "[REDACTED_PHONE]");
}

export function applyResolutionGate(
  resolution: AIResolution,
  allowedEvidenceIds: Set<string>
): { status: ResolutionStatus; resolution: AIResolution } {
  const evidence = resolution.evidence.filter((id) => allowedEvidenceIds.has(id));
  const normalized = {
    ...resolution,
    confidence: Math.max(0, Math.min(1, resolution.confidence)),
    answer: resolution.answer.trim().slice(0, 8_000),
    evidence,
  };

  if (HIGH_RISK_CATEGORIES.has(normalized.category) || normalized.outcome === "escalate") {
    return {
      status: "escalated",
      resolution: {
        ...normalized,
        answer:
          "This request needs a human review because it involves an account, policy, security, compliance, or other protected decision. The case has been escalated with the available diagnostic context; please do not share passwords, OTPs, cookies, access tokens, or private keys.",
      },
    };
  }
  if (normalized.outcome === "needs_customer") {
    return { status: "awaiting_customer", resolution: normalized };
  }
  if (normalized.confidence >= 0.9 && normalized.evidence.length > 0) {
    return { status: "auto_resolved", resolution: normalized };
  }
  return { status: "escalated", resolution: normalized };
}

export function aiInputHash(caseItem: SupportCase, messages: SupportMessage[]): string {
  const redacted = redactSensitiveText(
    JSON.stringify({
      caseId: caseItem.id,
      subject: caseItem.subject,
      messages: messages.map((item) => item.body),
    })
  );
  return crypto
    .createHash("sha256")
    .update(redacted)
    .digest("hex");
}

function configuredBaseUrl(): string {
  const value = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") throw new Error("AI_BASE_URL_INVALID");
  return value;
}

function outputText(payload: Record<string, unknown>): string | null {
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (part && typeof part === "object" && (part as { type?: string }).type === "output_text") {
        const text = (part as { text?: unknown }).text;
        if (typeof text === "string") return text;
      }
    }
  }
  return null;
}

function isResolution(value: unknown): value is AIResolution {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.category === "string" &&
    ["product_guidance", "integration_diagnostics", "deliverability", "billing", "security", "compliance", "account_restriction", "unknown"].includes(item.category) &&
    typeof item.outcome === "string" &&
    ["answer", "needs_customer", "escalate"].includes(item.outcome) &&
    typeof item.confidence === "number" &&
    typeof item.answer === "string" &&
    Array.isArray(item.evidence) &&
    item.evidence.every((entry) => typeof entry === "string")
  );
}

export async function generateAIResolution(input: {
  caseItem: SupportCase;
  messages: SupportMessage[];
  knowledge: KnowledgeItem[];
}): Promise<{ model: string; resolution: AIResolution; allowedEvidenceIds: Set<string> }> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) throw new Error("AI_NOT_CONFIGURED");

  const knowledge = [...BUILTIN_KNOWLEDGE, ...input.knowledge].slice(0, 8);
  const allowedEvidenceIds = new Set(knowledge.map((item) => item.id));
  const caseContext = redactSensitiveText(
    [input.caseItem.subject, ...input.messages.map((message) => `${message.senderType}: ${message.body}`)].join("\n")
  ).slice(0, 24_000);
  const knowledgeContext = knowledge
    .map((item) => `[${item.id}] ${item.title}\n${redactSensitiveText(item.body)}`)
    .join("\n\n")
    .slice(0, 24_000);

  const response = await fetch(`${configuredBaseUrl()}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 1_000,
      input: [
        {
          role: "system",
          content:
            "You are the thynkWISE support triage assistant. Use only the supplied evidence. Never claim that an external action, provider state, delivery, payment, deployment, or review succeeded unless the evidence explicitly proves it. Ask for missing non-secret details. Escalate billing, security, compliance, account restriction, ownership, and policy cases. Never request passwords, OTPs, access tokens, cookies, or private keys.",
        },
        { role: "user", content: `CASE\n${caseContext}\n\nAPPROVED KNOWLEDGE\n${knowledgeContext}` },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "support_resolution",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              category: { type: "string", enum: ["product_guidance", "integration_diagnostics", "deliverability", "billing", "security", "compliance", "account_restriction", "unknown"] },
              outcome: { type: "string", enum: ["answer", "needs_customer", "escalate"] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              answer: { type: "string" },
              evidence: { type: "array", items: { type: "string" } },
            },
            required: ["category", "outcome", "confidence", "answer", "evidence"],
          },
        },
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) throw new Error(`AI_PROVIDER_${response.status}`);
  const payload = (await response.json()) as Record<string, unknown>;
  if (payload.status !== "completed") throw new Error("AI_RESPONSE_INCOMPLETE");
  const text = outputText(payload);
  const parsed = text ? (JSON.parse(text) as unknown) : null;
  if (!isResolution(parsed)) throw new Error("AI_RESPONSE_INVALID");
  return { model, resolution: parsed, allowedEvidenceIds };
}

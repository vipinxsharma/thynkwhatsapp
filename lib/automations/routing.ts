import { RuleValidationError, TEMPLATE_VARIABLES_MAX, validateReplyText, validateTemplateVariables } from "./reply";

export interface RoutingInput {
  name: string;
  channelId: string | null;
  matchType: "exact" | "contains";
  keywords: string[];
  tags: string[];
  conversationStatus: "open" | "pending" | "closed" | null;
  /** Free-form reply sent inside the 24-hour window. May use {{name}} and {{phone}}. */
  replyText: string | null;
  /** Approved template used outside the window (or when no text reply is set). */
  replyTemplateName: string | null;
  replyTemplateLanguage: string | null;
  replyTemplateVariables: string[];
  priority: number;
  enabled: boolean;
}
export interface RoutingRule extends RoutingInput { id: string; updatedAt: string }
export { RuleValidationError };

const templateName = /^[a-z0-9_]{1,512}$/;
const templateLanguage = /^[A-Za-z_]{2,10}$/;

export function parseRoutingRule(value: unknown): RoutingInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RuleValidationError("A rule is required");
  const v = value as Record<string, unknown>;
  const list = (key: string, max: number, itemMax: number): string[] => {
    const raw = v[key];
    if (!Array.isArray(raw) || raw.length > max || raw.some(x => typeof x !== "string" || !x.trim() || x.length > itemMax)) {
      throw new RuleValidationError(`Invalid ${key}`);
    }
    return [...new Set(raw.map(x => (x as string).trim()))];
  };
  if (typeof v.name !== "string" || !v.name.trim() || v.name.length > 120) throw new RuleValidationError("Name must be 1–120 characters");
  if (v.matchType !== "exact" && v.matchType !== "contains") throw new RuleValidationError("Choose an exact or contains match");
  if (v.channelId !== null && (typeof v.channelId !== "string" || !/^\d{5,30}$/.test(v.channelId))) throw new RuleValidationError("Choose a connected channel or all channels");
  if (typeof v.enabled !== "boolean") throw new RuleValidationError("Enabled must be true or false");
  if (!Number.isInteger(v.priority) || Number(v.priority) < 0 || Number(v.priority) > 1000) throw new RuleValidationError("Priority must be 0–1000");
  if (v.conversationStatus !== null && (typeof v.conversationStatus !== "string" || !["open", "pending", "closed"].includes(v.conversationStatus))) throw new RuleValidationError("Invalid conversation status");
  const keywords = list("keywords", 30, 120), tags = list("tags", 20, 60);
  if (!keywords.length) throw new RuleValidationError("Add at least one keyword");

  const replyText = v.replyText === null || v.replyText === undefined || v.replyText === ""
    ? null : validateReplyText(v.replyText);
  const replyTemplate = v.replyTemplateName === null || v.replyTemplateName === undefined || v.replyTemplateName === ""
    ? null : v.replyTemplateName;
  if (replyTemplate !== null && (typeof replyTemplate !== "string" || !templateName.test(replyTemplate))) {
    throw new RuleValidationError("Template names use lowercase letters, numbers and underscores");
  }
  const language = replyTemplate === null ? null
    : (typeof v.replyTemplateLanguage === "string" && templateLanguage.test(v.replyTemplateLanguage) ? v.replyTemplateLanguage : null);
  if (replyTemplate !== null && language === null) throw new RuleValidationError("Choose the template language, for example en_US");
  const variables = v.replyTemplateVariables === undefined ? [] : validateTemplateVariables(v.replyTemplateVariables);
  if (replyTemplate === null && variables.length) throw new RuleValidationError("Template variables need a template name");
  if (variables.length > TEMPLATE_VARIABLES_MAX) throw new RuleValidationError("Too many template variables");

  const hasReply = replyText !== null || replyTemplate !== null;
  if (!tags.length && !v.conversationStatus && !hasReply) throw new RuleValidationError("Choose at least one action");

  return { name: v.name.trim(), channelId: v.channelId, matchType: v.matchType, keywords, tags,
    conversationStatus: v.conversationStatus as RoutingInput["conversationStatus"],
    replyText, replyTemplateName: replyTemplate, replyTemplateLanguage: language, replyTemplateVariables: variables,
    priority: Number(v.priority), enabled: v.enabled };
}
export function matchRoutingRule(rules: RoutingRule[], text: string, channelId: string): RoutingRule | null {
  const message = text.trim().toLocaleLowerCase("en-US");
  if (!message || text.length > 65536) return null;
  return [...rules].sort((a,b) => a.priority - b.priority || a.id.localeCompare(b.id)).find(rule =>
    rule.enabled && (!rule.channelId || rule.channelId === channelId) &&
    rule.keywords.some(keyword => rule.matchType === "exact"
      ? message === keyword.toLocaleLowerCase("en-US")
      : message.includes(keyword.toLocaleLowerCase("en-US")))) || null;
}

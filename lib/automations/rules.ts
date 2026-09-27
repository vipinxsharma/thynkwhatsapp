/**
 * Automated Bot & Keyword Trigger Rules Engine
 */

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  triggerType: "exact_match" | "contains_keyword" | "regex";
  keywords: string[];
  responseType: "text" | "interactive";
  replyText: string;
  interactiveButtons?: Array<{ id: string; title: string }>;
  assignTags?: string[];
  setConversationStatus?: "open" | "pending" | "closed";
  enabled: boolean;
  triggerCount: number;
}

export const defaultAutomationRules: AutomationRule[] = [
  {
    id: "rule_welcome",
    name: "New Lead Welcome Greeting",
    description: "Greets users when they say hello or hi, offering quick discovery options",
    triggerType: "contains_keyword",
    keywords: ["hi", "hello", "hey", "start", "namaste"],
    responseType: "interactive",
    replyText: "Hello! Welcome to thynkWISE. We specialize in Meta WhatsApp Business APIs and AI agent workflows. How can we help your business today?",
    interactiveButtons: [
      { id: "opt_demo", title: "Book a Live Demo" },
      { id: "opt_pricing", title: "View Pricing Plans" },
      { id: "opt_agent", title: "Talk to Human" },
    ],
    assignTags: ["Inbound Lead", "Engaged"],
    setConversationStatus: "open",
    enabled: true,
    triggerCount: 42,
  },
  {
    id: "rule_pricing",
    name: "Pricing & Tier Estimator",
    description: "Provides instant WhatsApp messaging tier pricing and cost breakdown",
    triggerType: "contains_keyword",
    keywords: ["price", "pricing", "cost", "quote", "rate", "tier"],
    responseType: "text",
    replyText: "Our WhatsApp Business plans start at $49/mo including 10,000 monthly active conversations. Meta Cloud API pass-through messaging rates: Marketing (~$0.075/conv), Utility (~$0.015/conv), Service (free for first 1,000). Would you like our full PDF pricing deck?",
    assignTags: ["High Intent", "Pricing Requested"],
    setConversationStatus: "open",
    enabled: true,
    triggerCount: 28,
  },
  {
    id: "rule_demo",
    name: "Schedule Product Demo",
    description: "Captures demo booking intent and invites to pick a calendar slot",
    triggerType: "contains_keyword",
    keywords: ["demo", "walkthrough", "presentation", "meeting", "call"],
    responseType: "interactive",
    replyText: "We'd love to show you how our multi-tenant inbox, HSM template approval, and broadcast engine work. Please pick your preferred meeting format:",
    interactiveButtons: [
      { id: "cal_30min", title: "Google Meet (30m)" },
      { id: "phone_callback", title: "Phone Callback" },
    ],
    assignTags: ["Lead: High Intent", "Demo Requested"],
    setConversationStatus: "open",
    enabled: true,
    triggerCount: 19,
  },
  {
    id: "rule_support",
    name: "Support Escalation & Ticket",
    description: "Flags customer support tickets and priority requests",
    triggerType: "contains_keyword",
    keywords: ["help", "support", "issue", "bug", "broken", "sla", "error"],
    responseType: "text",
    replyText: "Your inquiry has been escalated to Tier-1 Technical Support with priority SLA. An engineer is reviewing your account logs and will respond shortly.",
    assignTags: ["Support", "Priority"],
    setConversationStatus: "open",
    enabled: true,
    triggerCount: 14,
  },
];

let localRules: AutomationRule[] = [...defaultAutomationRules];

export class AutomationEngine {
  public static getRules(): AutomationRule[] {
    return localRules;
  }

  public static addRule(rule: Omit<AutomationRule, "id" | "triggerCount">): AutomationRule {
    const newRule: AutomationRule = {
      ...rule,
      id: `rule_${Date.now()}`,
      triggerCount: 0,
    };
    localRules.unshift(newRule);
    return newRule;
  }

  public static updateRule(id: string, updates: Partial<AutomationRule>): AutomationRule | null {
    const idx = localRules.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    localRules[idx] = { ...localRules[idx], ...updates };
    return localRules[idx];
  }

  public static deleteRule(id: string): boolean {
    const len = localRules.length;
    localRules = localRules.filter((r) => r.id !== id);
    return localRules.length < len;
  }

  public static toggleRule(id: string): AutomationRule | null {
    const idx = localRules.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    localRules[idx].enabled = !localRules[idx].enabled;
    return localRules[idx];
  }

  /**
   * Matches an incoming user text message against enabled automation rules
   */
  public static matchRule(messageText: string): AutomationRule | null {
    if (!messageText) return null;
    const cleanText = messageText.toLowerCase().trim();

    for (const rule of localRules) {
      if (!rule.enabled) continue;

      if (rule.triggerType === "exact_match") {
        if (rule.keywords.some((kw) => cleanText === kw.toLowerCase().trim())) {
          rule.triggerCount++;
          return rule;
        }
      } else if (rule.triggerType === "contains_keyword") {
        if (
          rule.keywords.some((kw) => {
            const pattern = new RegExp(`\\b${kw.toLowerCase().trim()}\\b`, "i");
            return pattern.test(cleanText) || cleanText.includes(kw.toLowerCase().trim());
          })
        ) {
          rule.triggerCount++;
          return rule;
        }
      } else if (rule.triggerType === "regex") {
        for (const kw of rule.keywords) {
          try {
            const rx = new RegExp(kw, "i");
            if (rx.test(cleanText)) {
              rule.triggerCount++;
              return rule;
            }
          } catch {
            // invalid regex skip
          }
        }
      }
    }

    return null;
  }
}

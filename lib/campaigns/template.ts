import type { MetaSendMessagePayload } from "@/types/meta-api";

export type TemplateInspection =
  | { ok: true; bodyVariables: number; category: string }
  | { ok: false; reason: string };

type TemplateComponent = {
  type?: string;
  format?: string;
  text?: string;
  buttons?: Array<{ type?: string; url?: string }>;
};

/**
 * Says whether a Meta template can be used for a campaign, and how many body
 * variables it needs. Campaigns only fill numbered body variables ({{1}}, {{2}}…).
 */
export function inspectTemplate(template: { status?: string; category?: string; components?: unknown }): TemplateInspection {
  if (template.status !== "APPROVED") return { ok: false, reason: "Template is not approved by Meta" };
  const components = (Array.isArray(template.components) ? template.components : []) as TemplateComponent[];
  let bodyVariables = 0;
  for (const component of components) {
    const type = String(component.type || "").toUpperCase();
    const text = component.text || "";
    if (type === "HEADER") {
      if (component.format && component.format.toUpperCase() !== "TEXT") {
        return { ok: false, reason: "Templates with an image, video or document header are not supported yet" };
      }
      if (text.includes("{{")) return { ok: false, reason: "Templates with a variable in the header are not supported yet" };
    }
    if (type === "BODY") {
      const placeholders = text.match(/\{\{\s*[^}]+\s*\}\}/g) || [];
      const numbers = new Set<number>();
      for (const placeholder of placeholders) {
        const inner = placeholder.replace(/[{}\s]/g, "");
        if (!/^\d+$/.test(inner)) return { ok: false, reason: "Templates with named variables are not supported yet" };
        numbers.add(Number(inner));
      }
      bodyVariables = numbers.size;
      for (let index = 1; index <= bodyVariables; index += 1) {
        if (!numbers.has(index)) return { ok: false, reason: "Template body variables must be numbered 1, 2, 3 without gaps" };
      }
    }
    if (type === "BUTTONS") {
      for (const button of component.buttons || []) {
        const buttonType = String(button.type || "").toUpperCase();
        if (buttonType === "URL" && (button.url || "").includes("{{")) {
          return { ok: false, reason: "Templates with a variable in a button link are not supported yet" };
        }
        if (["COPY_CODE", "OTP", "FLOW", "CATALOG", "MPM"].includes(buttonType)) {
          return { ok: false, reason: "This template's button type is not supported for campaigns yet" };
        }
      }
    }
  }
  return { ok: true, bodyVariables, category: String(template.category || "") };
}

/** Variables may use {{name}} and {{phone}}, filled per recipient. */
export function resolveVariable(value: string, recipient: { name: string; waId: string }): string {
  const name = recipient.name.trim() && recipient.name.trim() !== recipient.waId ? recipient.name.trim() : "there";
  const resolved = value.replace(/\{\{\s*name\s*\}\}/gi, name).replace(/\{\{\s*phone\s*\}\}/gi, `+${recipient.waId}`).trim();
  return resolved || "-";
}

export function buildCampaignPayload(input: {
  templateName: string;
  templateLanguage: string;
  variables: string[];
  recipient: { name: string; waId: string };
}): MetaSendMessagePayload {
  return {
    messaging_product: "whatsapp",
    to: input.recipient.waId,
    type: "template",
    template: {
      name: input.templateName,
      language: { code: input.templateLanguage },
      components: input.variables.length > 0
        ? [{
            type: "body",
            parameters: input.variables.map((value) => ({ type: "text", text: resolveVariable(value, input.recipient) })),
          }]
        : undefined,
    },
  };
}

const OPT_OUT_KEYWORDS = new Set(["stop", "unsubscribe", "opt out", "optout", "stop promotions"]);

/** True when an inbound text is a clear request to stop marketing messages. */
export function isOptOutMessage(text: string): boolean {
  return OPT_OUT_KEYWORDS.has(text.trim().toLowerCase().replace(/[.!]+$/, ""));
}

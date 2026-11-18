import { describe, expect, it } from "vitest";
import { buildCampaignPayload, inspectTemplate, isOptOutMessage, resolveVariable } from "../lib/campaigns/template";

const approvedBody = (text: string, extra: unknown[] = []) => ({
  status: "APPROVED",
  category: "MARKETING",
  components: [{ type: "BODY", text }, ...extra],
});

describe("inspectTemplate", () => {
  it("accepts an approved text template and counts its variables", () => {
    expect(inspectTemplate(approvedBody("Hi {{1}}, order {{2}} is ready"))).toEqual({
      ok: true, bodyVariables: 2, category: "MARKETING",
    });
  });

  it("refuses templates Meta has not approved", () => {
    const result = inspectTemplate({ ...approvedBody("Hi"), status: "PENDING" });
    expect(result.ok).toBe(false);
  });

  it("refuses named variables and gaps in numbering", () => {
    expect(inspectTemplate(approvedBody("Hi {{name}}")).ok).toBe(false);
    expect(inspectTemplate(approvedBody("Hi {{2}} only")).ok).toBe(false);
  });

  it("refuses media headers and variables inside button links", () => {
    expect(inspectTemplate({ ...approvedBody("Hi"), components: [
      { type: "HEADER", format: "IMAGE" }, { type: "BODY", text: "Hi" },
    ] }).ok).toBe(false);
    expect(inspectTemplate({ ...approvedBody("Hi"), components: [
      { type: "BODY", text: "Hi" },
      { type: "BUTTONS", buttons: [{ type: "URL", url: "https://x.test/{{1}}" }] },
    ] }).ok).toBe(false);
  });

  it("refuses button types that cannot be sent as campaigns", () => {
    const result = inspectTemplate({ ...approvedBody("Your code"), components: [
      { type: "BODY", text: "Your code" }, { type: "BUTTONS", buttons: [{ type: "COPY_CODE" }] },
    ] });
    expect(result.ok).toBe(false);
  });
});

describe("resolveVariable and buildCampaignPayload", () => {
  const recipient = { name: "Asha Rao", waId: "919876543210" };

  it("fills {{name}} and {{phone}} per recipient and falls back to 'there'", () => {
    expect(resolveVariable("{{name}}", recipient)).toBe("Asha Rao");
    expect(resolveVariable("{{phone}}", recipient)).toBe("+919876543210");
    expect(resolveVariable("Hello {{name}}", { name: "919876543210", waId: "919876543210" })).toBe("Hello there");
    expect(resolveVariable("  ", recipient)).toBe("-");
  });

  it("builds a template payload with the body parameters in order", () => {
    const payload = buildCampaignPayload({
      templateName: "flash_sale", templateLanguage: "en_US", variables: ["{{name}}", "50%"], recipient,
    });
    expect(payload).toEqual({
      messaging_product: "whatsapp",
      to: "919876543210",
      type: "template",
      template: {
        name: "flash_sale",
        language: { code: "en_US" },
        components: [{ type: "body", parameters: [
          { type: "text", text: "Asha Rao" }, { type: "text", text: "50%" },
        ] }],
      },
    });
  });

  it("omits components when the template has no variables", () => {
    const payload = buildCampaignPayload({ templateName: "t", templateLanguage: "en_US", variables: [], recipient });
    expect(payload.template?.components).toBeUndefined();
  });
});

describe("isOptOutMessage", () => {
  it("recognises clear stop requests only", () => {
    expect(isOptOutMessage("STOP")).toBe(true);
    expect(isOptOutMessage(" unsubscribe. ")).toBe(true);
    expect(isOptOutMessage("please stop sending offers to my wife")).toBe(false);
    expect(isOptOutMessage("")).toBe(false);
  });
});

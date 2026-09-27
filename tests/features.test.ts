import { describe, it, expect } from "vitest";
import { StrapiClient } from "../lib/strapi/client";
import { AutomationEngine } from "../lib/automations/rules";
import { CampaignStore } from "../lib/campaigns/store";

describe("CRM Contact Management Suite", () => {
  const strapi = new StrapiClient();

  it("should create a new contact and automatically spin up a conversation", async () => {
    const res = await strapi.createContact({
      name: "Devina Kapoor",
      phoneNumber: "+919876500112",
      tags: ["Enterprise", "Lead"],
      customAttributes: { company: "Kapoor Tech" },
    });

    expect(res.contact.name).toBe("Devina Kapoor");
    expect(res.contact.phoneNumber).toBe("+919876500112");
    expect(res.contact.waId).toBe("919876500112");
    expect(res.conversation).toBeDefined();
    expect(res.conversation.contact.name).toBe("Devina Kapoor");
  });

  it("should update contact details and CRM tags", async () => {
    const contacts = await strapi.getContacts();
    const target = contacts[0];

    const updated = await strapi.updateContact(target.id, {
      name: `${target.name} (Verified)`,
      tags: [...target.tags, "VIP Client"],
    });

    expect(updated).not.toBeNull();
    expect(updated?.name).toContain("(Verified)");
    expect(updated?.tags).toContain("VIP Client");
  });

  it("should bulk import CSV contacts while filtering invalid or duplicate numbers", async () => {
    const sampleBatch = [
      { name: "User One", phoneNumber: "+919111122233", company: "Company A" },
      { name: "User Two", phoneNumber: "+919222233344", company: "Company B" },
      { name: "", phoneNumber: "+919333344455" }, // Invalid (no name)
      { name: "User One Dup", phoneNumber: "+919111122233" }, // Duplicate
    ];

    const res = await strapi.bulkImportContacts(sampleBatch);
    expect(res.created).toBe(2);
    expect(res.skipped).toBe(2);
  });
});

describe("Automated Bot & Keyword Triggers Engine", () => {
  it("should match pricing keyword triggers", () => {
    const rule = AutomationEngine.matchRule("Can you share your WhatsApp pricing and rates?");
    expect(rule).not.toBeNull();
    expect(rule?.id).toBe("rule_pricing");
    expect(rule?.replyText).toContain("Our WhatsApp Business plans start at $49/mo");
  });

  it("should match welcome greetings", () => {
    const rule = AutomationEngine.matchRule("Hi team, good morning!");
    expect(rule).not.toBeNull();
    expect(rule?.id).toBe("rule_welcome");
    expect(rule?.responseType).toBe("interactive");
    expect(rule?.interactiveButtons?.length).toBeGreaterThan(0);
  });

  it("should match demo requests", () => {
    const rule = AutomationEngine.matchRule("I would like to schedule a demo call tomorrow");
    expect(rule).not.toBeNull();
    expect(rule?.id).toBe("rule_demo");
  });

  it("should allow dynamically creating, toggling, and testing custom rules", () => {
    const customRule = AutomationEngine.addRule({
      name: "Black Friday Discount",
      description: "Auto responds with holiday coupon code",
      triggerType: "contains_keyword",
      keywords: ["blackfriday", "coupon", "discount"],
      responseType: "text",
      replyText: "Use coupon CODE2026 to get 20% off all broadcasts!",
      enabled: true,
    });

    expect(customRule.id).toBeDefined();

    const matched = AutomationEngine.matchRule("Do you have any blackfriday discounts?");
    expect(matched?.id).toBe(customRule.id);

    // Toggle off
    AutomationEngine.toggleRule(customRule.id);
    const matchedAfterDisable = AutomationEngine.matchRule("Do you have any blackfriday discounts?");
    expect(matchedAfterDisable?.id).not.toBe(customRule.id);
  });
});

describe("Broadcast Campaign Engine", () => {
  it("should retrieve historical broadcast runs", () => {
    const campaigns = CampaignStore.getAll();
    expect(campaigns.length).toBeGreaterThanOrEqual(2);
    expect(campaigns[0].status).toBe("completed");
    expect(campaigns[0].deliveredCount).toBeGreaterThan(0);
  });

  it("should record a new campaign run with delivery receipts and cost", () => {
    const newRun = CampaignStore.add({
      name: "Q1 Renewal Blast",
      templateName: "order_confirmation_v1",
      segment: "customers",
      totalRecipients: 50,
      sentCount: 50,
      deliveredCount: 49,
      readCount: 41,
      failedCount: 1,
      estimatedCostUSD: 0.75,
      status: "completed",
    });

    expect(newRun.id).toBeDefined();
    expect(newRun.createdAt).toBeDefined();

    const all = CampaignStore.getAll();
    expect(all[0].id).toBe(newRun.id);
  });
});

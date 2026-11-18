import { describe, expect, it } from "vitest";
import {
  actionsForStatus, audienceFromContacts, batchSummaryLines, canManageCampaigns, confirmationCopy, countRows,
  filterConsentContacts, formatCount, previewBody, problemReason, remainingRecipients, roleLimitMessage,
  selectableTemplates, shouldPoll, tagsFromContacts, uuidV4, variableProblem, POLL_INTERVAL_MS,
} from "@/components/campaigns/campaign-helpers";
import type { ConsentContact } from "@/lib/campaigns/store";

const counts = { total: 10, pending: 4, sending: 1, sent: 3, delivered: 1, read: 0, failed: 1, uncertain: 0, skipped: 0 };

describe("campaign status to actions", () => {
  it("offers start and cancel for drafts and paused campaigns, and pause only while sending", () => {
    expect(actionsForStatus("draft")).toEqual(["start", "cancel"]);
    expect(actionsForStatus("paused")).toEqual(["start", "cancel"]);
    expect(actionsForStatus("sending")).toEqual(["send_batch", "pause", "cancel"]);
  });

  it("offers nothing once a campaign is finished", () => {
    expect(actionsForStatus("completed")).toEqual([]);
    expect(actionsForStatus("cancelled")).toEqual([]);
  });

  it("polls only while a campaign is sending, every 15 seconds", () => {
    expect(shouldPoll("sending")).toBe(true);
    expect(shouldPoll("paused")).toBe(false);
    expect(shouldPoll(null)).toBe(false);
    expect(POLL_INTERVAL_MS).toBe(15000);
  });
});

describe("roles", () => {
  it("only owners and admins can manage campaigns", () => {
    expect(canManageCampaigns("owner")).toBe(true);
    expect(canManageCampaigns("admin")).toBe(true);
    expect(canManageCampaigns("agent")).toBe(false);
    expect(canManageCampaigns("viewer")).toBe(false);
    expect(canManageCampaigns(undefined)).toBe(false);
  });

  it("explains the role limit only to people who cannot manage", () => {
    expect(roleLimitMessage("owner")).toBeNull();
    expect(roleLimitMessage("viewer")).toMatch(/owners and admins/);
  });
});

describe("plain-language confirmations", () => {
  const campaign = { name: "May offer", templateName: "offer_may", phoneNumberId: "123456789", counts };

  it("says what will be sent and to how many on start", () => {
    const copy = confirmationCopy("start", campaign);
    expect(copy.title).toBe('Start "May offer"?');
    expect(copy.body).toContain('template "offer_may"');
    expect(copy.body).toContain("5 opted-in contact(s)");
  });

  it("says how many unsent recipients a cancel will skip", () => {
    const copy = confirmationCopy("cancel", campaign);
    expect(copy.body).toContain("5 recipient(s) not yet sent");
    expect(copy.body).toContain("cannot be recalled");
  });

  it("counts remaining recipients from pending and sending", () => {
    expect(remainingRecipients(counts)).toBe(5);
  });
});

describe("counts and problems", () => {
  it("lists the counts in the order the screen shows them", () => {
    expect(countRows(counts).map((row) => row.key)).toEqual(["total", "sent", "delivered", "read", "failed", "uncertain", "skipped"]);
  });

  it("gives a reason for each problem, with a default when Meta gave none", () => {
    expect(problemReason({ status: "failed", error: " Number not on WhatsApp " })).toBe("Number not on WhatsApp");
    expect(problemReason({ status: "failed", error: null })).toMatch(/did not accept/);
    expect(problemReason({ status: "uncertain", error: null })).toMatch(/not retried/);
    expect(problemReason({ status: "skipped", error: null })).toMatch(/skipped/);
  });
});

describe("audience and consent", () => {
  const contacts: ConsentContact[] = [
    { id: "1", name: "Asha", phoneNumber: "919900000001", tags: ["vip"], consent: "opted_in" },
    { id: "2", name: "Ravi", phoneNumber: "919900000002", tags: ["vip", "north"], consent: "opted_out" },
    { id: "3", name: "Meera", phoneNumber: "919900000003", tags: [], consent: null },
    { id: "4", name: "Kiran", phoneNumber: "919900000004", tags: ["north"], consent: "opted_in" },
  ];

  it("counts the audience and the opted-in members, with and without a tag", () => {
    expect(audienceFromContacts(contacts, null)).toEqual({ contacts: 4, optedIn: 2 });
    expect(audienceFromContacts(contacts, "vip")).toEqual({ contacts: 2, optedIn: 1 });
  });

  it("lists distinct tags alphabetically", () => {
    expect(tagsFromContacts(contacts)).toEqual(["north", "vip"]);
  });

  it("filters by search text, tag and consent state", () => {
    expect(filterConsentContacts(contacts, { query: "ravi", tag: null, consent: "all" }).map((c) => c.id)).toEqual(["2"]);
    expect(filterConsentContacts(contacts, { query: "", tag: "north", consent: "opted_in" }).map((c) => c.id)).toEqual(["4"]);
    expect(filterConsentContacts(contacts, { query: "", tag: null, consent: "none" }).map((c) => c.id)).toEqual(["3"]);
    expect(filterConsentContacts(contacts, { query: "9900000003", tag: null, consent: "all" }).map((c) => c.id)).toEqual(["3"]);
  });

  it("formats counts with grouping", () => {
    expect(formatCount(12345)).toBe("12,345");
  });
});

describe("templates and variables", () => {
  const approved = {
    name: "offer_may",
    language: "en",
    status: "APPROVED",
    category: "MARKETING",
    components: [{ type: "BODY", text: "Hi {{1}}, call {{2}} for the offer" }],
  };

  it("offers only approved templates the sender can fill", () => {
    const options = selectableTemplates([
      approved,
      { ...approved, name: "pending_one", status: "PENDING" },
      { ...approved, name: "named_vars", components: [{ type: "BODY", text: "Hi {{name}}" }] },
    ]);
    expect(options.map((option) => option.name)).toEqual(["offer_may"]);
    expect(options[0].bodyVariables).toBe(2);
  });

  it("previews variables with the {{name}} and {{phone}} helpers", () => {
    const text = previewBody("Hi {{1}}, call {{2}}", ["{{name}}", "{{phone}}"], { name: "Asha", waId: "919900000001" });
    expect(text).toBe("Hi Asha, call +919900000001");
  });

  it("requires one non-empty value per variable, each at most 500 characters", () => {
    expect(variableProblem(["a"], 2)).toMatch(/needs 2/);
    expect(variableProblem(["a", "  "], 2)).toMatch(/needs a value/);
    expect(variableProblem(["a", "x".repeat(501)], 2)).toMatch(/500/);
    expect(variableProblem(["a", "b"], 2)).toBeNull();
  });
});

describe("batch summary and ids", () => {
  it("describes a batch and says when the campaign was paused", () => {
    const lines = batchSummaryLines({
      status: "sending", claimed: 10, sent: 8, failed: 1, skipped: 1, uncertain: 0, released: 0, pausedReason: "Rate limit reached",
    });
    expect(lines).toContain("8 sent");
    expect(lines).toContain("Campaign paused: Rate limit reached");
    expect(lines.some((line) => line.includes("released"))).toBe(false);
  });

  it("formats a version 4 UUID from random bytes", () => {
    const id = uuidV4(new Uint8Array(16).fill(0xff));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(id).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  });
});

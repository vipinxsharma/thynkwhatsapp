import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const auth = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => ({ ok: true, session: { tenantId: "workspace", userId: "agent-1", role: "owner" } }) as any));
const crm = vi.hoisted(() => ({
  listContactsPage: vi.fn(async (..._args: unknown[]) => ({ contacts: [] as unknown[], total: 0 })),
  listContactTags: vi.fn(async (..._args: unknown[]) => ["VIP"]),
  listContactFieldDefinitions: vi.fn(async (..._args: unknown[]) => [] as any[]),
  setContactGroups: vi.fn(async (..._args: unknown[]) => undefined),
  setContactConsent: vi.fn(async (..._args: unknown[]) => 1),
  addContactsToGroup: vi.fn(async (..._args: unknown[]) => 1),
  findOrCreateContactGroupByName: vi.fn(async (..._args: unknown[]) => ({ id: "22222222-2222-4222-8222-222222222222", name: "Leads" })),
}));
const inbox = vi.hoisted(() => ({
  ensureContactConversation: vi.fn(),
  updateContact: vi.fn(async (..._args: unknown[]) => null as unknown),
}));
const strapi = vi.hoisted(() => ({ durable: true }));

vi.mock("@/lib/auth/session", () => ({ requireApiSession: auth }));
vi.mock("@/lib/contacts/store", () => crm);
vi.mock("@/lib/inbox/store", () => inbox);
vi.mock("@/lib/strapi/client", () => ({
  isDurableInboxEnabled: () => strapi.durable,
  StrapiClient: class {
    async getConversations() {
      return [];
    }
    async getContacts() {
      return [];
    }
    async createContact() {
      return { contact: { id: "c", name: "x", phoneNumber: "+1", waId: "1", tags: [], customAttributes: {} }, conversation: { id: "v", windowExpiresAt: "", lastMessageAt: "" } };
    }
  },
}));

import { GET } from "../app/api/contacts/route";
import { POST as consentPost } from "../app/api/contacts/consent/route";
import { POST as importPost } from "../app/api/contacts/import/route";

const contactId = "11111111-1111-4111-8111-111111111111";
const groupId = "22222222-2222-4222-8222-222222222222";
const post = (url: string, body: unknown) => new NextRequest(url, { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  strapi.durable = true;
  crm.listContactsPage.mockResolvedValue({ contacts: [], total: 240 });
});
afterEach(() => vi.clearAllMocks());

describe("GET /api/contacts (server-side pagination)", () => {
  it("passes page, filters and a capped page size to the store", async () => {
    const response = await GET(new NextRequest(`https://xeccel.com/api/contacts?page=3&pageSize=500&search=asha&group=${groupId}&consent=unsubscribed&tag=VIP`));
    expect(response.status).toBe(200);
    expect(crm.listContactsPage).toHaveBeenCalledWith("workspace", {
      page: 3,
      pageSize: 100,
      search: "asha",
      tag: "VIP",
      groupId,
      consent: "unsubscribed",
    });
    const body = await response.json();
    expect(body.pagination).toEqual({ page: 3, pageSize: 100, total: 240, totalPages: 3 });
    expect(body.tags).toEqual(["VIP"]);
  });

  it("rejects malformed paging and filters without querying", async () => {
    for (const query of ["page=0", "pageSize=abc", "group=not-a-uuid", "consent=maybe"]) {
      const response = await GET(new NextRequest(`https://xeccel.com/api/contacts?${query}`));
      expect(response.status).toBe(400);
    }
    expect(crm.listContactsPage).not.toHaveBeenCalled();
  });
});

describe("POST /api/contacts/consent", () => {
  it("rejects users outside the allowed roles without writing", async () => {
    auth.mockResolvedValueOnce({ ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    const response = await consentPost(post("https://xeccel.com/api/contacts/consent", { contactIds: [contactId], status: "unsubscribed" }));
    expect(response.status).toBe(403);
    expect(crm.setContactConsent).not.toHaveBeenCalled();
  });

  it("validates status and IDs before writing", async () => {
    expect((await consentPost(post("https://xeccel.com/api/contacts/consent", { contactIds: [contactId], status: "deleted" }))).status).toBe(400);
    expect((await consentPost(post("https://xeccel.com/api/contacts/consent", { contactIds: ["bad"], status: "unsubscribed" }))).status).toBe(400);
    expect((await consentPost(post("https://xeccel.com/api/contacts/consent", { contactIds: [], status: "unsubscribed" }))).status).toBe(400);
    expect(crm.setContactConsent).not.toHaveBeenCalled();
  });

  it("records the opt-out with the signed-in user", async () => {
    const response = await consentPost(post("https://xeccel.com/api/contacts/consent", { contactIds: [contactId], status: "unsubscribed" }));
    expect(response.status).toBe(200);
    expect(crm.setContactConsent).toHaveBeenCalledWith("workspace", "agent-1", [contactId], "unsubscribed");
  });

  it("is unavailable without the durable inbox", async () => {
    strapi.durable = false;
    const response = await consentPost(post("https://xeccel.com/api/contacts/consent", { contactIds: [contactId], status: "subscribed" }));
    expect(response.status).toBe(503);
    expect(crm.setContactConsent).not.toHaveBeenCalled();
  });
});

describe("POST /api/contacts/import", () => {
  it("imports valid rows with typed attributes and reports invalid typed values", async () => {
    crm.listContactFieldDefinitions.mockResolvedValueOnce([
      { id: "f1", key: "customer_tier", label: "Customer tier", type: "choice", choices: ["Gold", "Silver"] },
    ]);
    inbox.ensureContactConversation
      .mockResolvedValueOnce({ contact: { id: contactId }, created: true })
      .mockResolvedValueOnce({ contact: { id: contactId }, created: false });

    const response = await importPost(
      post("https://xeccel.com/api/contacts/import", {
        groupId,
        contacts: [
          { name: "Asha", phoneNumber: "+919811122233", customAttributes: { customer_tier: "gold" }, groupName: "Leads" },
          { name: "Ravi", phoneNumber: "+919811122234", customAttributes: { customer_tier: "Platinum" } },
          { name: "Mira", phoneNumber: "+919811122235", customAttributes: { customer_tier: "Silver" } },
        ],
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({ created: 1, existing: 1, invalid: 1, skipped: 2 });
    expect(body.data.errors[0].row).toBe(2);

    expect(inbox.ensureContactConversation).toHaveBeenCalledTimes(2);
    expect(inbox.ensureContactConversation.mock.calls[0][0]).toMatchObject({
      workspaceId: "workspace",
      phoneNumber: "+919811122233",
      customAttributes: { customer_tier: "Gold" },
    });
    // Existing contacts get their attributes merged; groups are assigned to every matched row.
    expect(inbox.updateContact).toHaveBeenCalledWith("workspace", contactId, { customAttributes: { customer_tier: "Silver" } });
    expect(crm.findOrCreateContactGroupByName).toHaveBeenCalledWith("workspace", "agent-1", "Leads");
    expect(crm.addContactsToGroup).toHaveBeenCalledWith("workspace", groupId, [contactId]);
  });

  it("refuses oversized batches before doing any work", async () => {
    const contacts = Array.from({ length: 501 }, (_, i) => ({ name: `N${i}`, phoneNumber: `+9198${String(i).padStart(8, "0")}` }));
    const response = await importPost(post("https://xeccel.com/api/contacts/import", { contacts }));
    expect(response.status).toBe(400);
    expect(inbox.ensureContactConversation).not.toHaveBeenCalled();
  });
});

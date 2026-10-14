import {
  initialConversations,
  initialMessages,
  initialWABA,
  sampleTemplates,
} from "./mock-data";
import { Contact, Conversation, Message, MessageTemplate, WABAAccount } from "@/types/strapi";
import * as inboxStore from "@/lib/inbox/store";
import { getMetaConnectionForWorkspace } from "@/lib/meta/connections";
import { MetaGraphClient } from "@/lib/meta/client";

export function isDurableInboxEnabled(): boolean {
  return process.env.INBOX_STORAGE === "postgres" && Boolean(process.env.DATABASE_URL);
}

const STRAPI_URL = process.env.STRAPI_INTERNAL_URL || "http://localhost:1337";
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

interface LocalTenantState {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  waba: WABAAccount;
  templates: MessageTemplate[];
}

const localTenantStates = new Map<string, LocalTenantState>();

function createLocalTenantState(): LocalTenantState {
  return {
    conversations: structuredClone(initialConversations),
    messages: structuredClone(initialMessages),
    waba: structuredClone(initialWABA),
    templates: structuredClone(sampleTemplates),
  };
}

function getLocalTenantState(tenantId: string): LocalTenantState {
  let state = localTenantStates.get(tenantId);
  if (!state) {
    state = createLocalTenantState();
    localTenantStates.set(tenantId, state);
  }
  return state;
}

export class StrapiClient {
  private tenantId: string;

  constructor(tenantId: string) {
    if (!tenantId) throw new Error("A server-derived tenant ID is required");
    this.tenantId = tenantId;
  }

  private get localState(): LocalTenantState {
    if (process.env.NODE_ENV === "production") {
      throw new Error("In-memory demo data is unavailable in production");
    }
    return getLocalTenantState(this.tenantId);
  }

  /**
   * Fetches active WABA account information for the current tenant
   */
  public async getWABA(): Promise<WABAAccount> {
    if (isDurableInboxEnabled()) return inboxStore.getWABA(this.tenantId);
    if (process.env.USE_REAL_STRAPI === "true" && STRAPI_TOKEN) {
      const res = await fetch(`${STRAPI_URL}/api/wabas?filters[tenant][id][$eq]=${this.tenantId}&populate=*`, {
        headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.[0]) {
          return json.data[0];
        }
      }
    }
    return this.localState.waba;
  }

  /**
   * Fetches all conversations scoped to the tenant
   */
  public async getConversations(): Promise<Conversation[]> {
    if (isDurableInboxEnabled()) return inboxStore.listConversations(this.tenantId);
    if (process.env.USE_REAL_STRAPI === "true" && STRAPI_TOKEN) {
      const res = await fetch(
        `${STRAPI_URL}/api/conversations?filters[tenant][id][$eq]=${this.tenantId}&populate[contact]=*&populate[phoneNumber]=*&populate[lastMessage]=*&sort=lastMessageAt:desc`,
        {
          headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
          cache: "no-store",
        }
      );
      if (res.ok) {
        const json = await res.json();
        return json.data || [];
      }
    }
    return this.localState.conversations;
  }

  /**
   * Fetches message history for a conversation
   */
  public async getMessages(conversationId: string | number): Promise<Message[]> {
    const convIdStr = String(conversationId);
    if (isDurableInboxEnabled()) return inboxStore.getMessages(this.tenantId, convIdStr);
    if (process.env.USE_REAL_STRAPI === "true" && STRAPI_TOKEN) {
      const res = await fetch(
        `${STRAPI_URL}/api/messages?filters[conversation][id][$eq]=${convIdStr}&sort=timestamp:asc`,
        {
          headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
          cache: "no-store",
        }
      );
      if (res.ok) {
        const json = await res.json();
        return json.data || [];
      }
    }
    return this.localState.messages[convIdStr] || [];
  }

  /**
   * Appends an outbound or inbound message to the conversation
   */
  public async recordMessage(
    conversationId: string | number,
    message: Omit<Message, "id">
  ): Promise<Message> {
    if (isDurableInboxEnabled()) return inboxStore.recordMessage(this.tenantId, String(conversationId), message);
    const convIdStr = String(conversationId);
    const newId = Date.now();
    const createdMessage: Message = {
      ...message,
      id: newId,
      conversationId: convIdStr,
    };

    if (!this.localState.messages[convIdStr]) {
      this.localState.messages[convIdStr] = [];
    }
    this.localState.messages[convIdStr].push(createdMessage);

    // Update conversation last message & timestamp
    const convIndex = this.localState.conversations.findIndex((c) => String(c.id) === convIdStr);
    if (convIndex !== -1) {
      this.localState.conversations[convIndex].lastMessage = createdMessage;
      this.localState.conversations[convIndex].lastMessageAt = createdMessage.timestamp;
      if (createdMessage.direction === "inbound") {
        // Refresh the 24h window
        this.localState.conversations[convIndex].windowExpiresAt = new Date(
          new Date(createdMessage.timestamp).getTime() + 24 * 60 * 60 * 1000
        ).toISOString();
      }
    }

    return createdMessage;
  }

  /**
   * Updates message status (delivered, read, failed)
   */
  public async updateMessageStatus(wamId: string, status: Message["status"]): Promise<void> {
    if (isDurableInboxEnabled()) return inboxStore.updateMessageStatus(this.tenantId, wamId, status);
    for (const messages of Object.values(this.localState.messages)) {
      const msg = messages.find((m) => m.wamId === wamId);
      if (msg) {
        msg.status = status;
        break;
      }
    }
  }

  /**
   * Updates contact CRM tags
   */
  public async updateContactTags(contactId: string | number, tags: string[]): Promise<void> {
    if (isDurableInboxEnabled()) {
      await inboxStore.updateContact(this.tenantId, String(contactId), { tags });
      return;
    }
    for (const conv of this.localState.conversations) {
      if (String(conv.contact.id) === String(contactId)) {
        conv.contact.tags = tags;
      }
    }
  }

  /**
   * Fetches all contacts
   */
  public async getContacts(): Promise<Contact[]> {
    if (isDurableInboxEnabled()) return (await inboxStore.listConversations(this.tenantId)).map((c) => c.contact);
    const contactsMap = new Map<string, Contact>();
    for (const conv of this.localState.conversations) {
      contactsMap.set(String(conv.contact.id), conv.contact);
    }
    return Array.from(contactsMap.values());
  }

  /**
   * Creates a new contact and sets up a default conversation
   */
  public async createContact(data: {
    name: string;
    phoneNumber: string;
    tags?: string[];
    customAttributes?: Record<string, any>;
    connectedPhone?: Conversation["phoneNumber"];
    inbound?: boolean;
  }): Promise<{ contact: Contact; conversation: Conversation }> {
    if (isDurableInboxEnabled()) {
      return inboxStore.ensureContactConversation({
        workspaceId: this.tenantId,
        name: data.name,
        phoneNumber: data.phoneNumber,
        tags: data.tags,
        customAttributes: data.customAttributes,
        phoneNumberId: data.connectedPhone?.phoneNumberId,
        inbound: data.inbound,
      });
    }
    const rawDigits = data.phoneNumber.replace(/\D/g, "");
    const waId = rawDigits;
    const formattedPhone = data.phoneNumber.startsWith("+") ? data.phoneNumber : `+${rawDigits}`;

    const newContactId = Date.now();
    const newContact: Contact = {
      id: newContactId,
      waId,
      phoneNumber: formattedPhone,
      name: data.name,
      tags: data.tags || ["New Contact"],
      customAttributes: data.customAttributes || {},
      lastSeenAt: new Date().toISOString(),
    };

    const newConvId = this.localState.conversations.length + 1;
    const newConv: Conversation = {
      id: newConvId,
      status: "open",
      // Initially, 24h window starts expired if initiated by business without an incoming user message
      windowExpiresAt: new Date(Date.now() - 1000).toISOString(),
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
      contact: newContact,
      phoneNumber: data.connectedPhone || this.localState.waba.phoneNumbers?.[0] || {
        id: 1,
        phoneNumberId: "105678234901234",
        displayPhoneNumber: "+91 98765 43210",
        verifiedName: "thynkWISE Sales & Support",
        qualityRating: "GREEN",
        codeVerificationStatus: "VERIFIED",
      },
    };

    this.localState.conversations.unshift(newConv);
    this.localState.messages[String(newConvId)] = [];

    return { contact: newContact, conversation: newConv };
  }

  /**
   * Updates an existing contact
   */
  public async updateContact(
    contactId: string | number,
    data: Partial<Contact>
  ): Promise<Contact | null> {
    if (isDurableInboxEnabled()) return inboxStore.updateContact(this.tenantId, String(contactId), data);
    let updatedContact: Contact | null = null;
    for (const conv of this.localState.conversations) {
      if (String(conv.contact.id) === String(contactId)) {
        conv.contact = {
          ...conv.contact,
          ...data,
          customAttributes: {
            ...conv.contact.customAttributes,
            ...(data.customAttributes || {}),
          },
        };
        updatedContact = conv.contact;
      }
    }
    return updatedContact;
  }

  /**
   * Deletes a contact and their associated conversation
   */
  public async deleteContact(contactId: string | number): Promise<boolean> {
    if (isDurableInboxEnabled()) return inboxStore.deleteContact(this.tenantId, String(contactId));
    const initialLength = this.localState.conversations.length;
    this.localState.conversations = this.localState.conversations.filter(
      (c) => String(c.contact.id) !== String(contactId)
    );
    return this.localState.conversations.length < initialLength;
  }

  /**
   * Bulk imports contacts
   */
  public async bulkImportContacts(
    contacts: Array<{
      name: string;
      phoneNumber: string;
      tags?: string[];
      company?: string;
    }>
  ): Promise<{ created: number; skipped: number }> {
    if (isDurableInboxEnabled()) {
      let created = 0;
      let skipped = 0;
      for (const contact of contacts) {
        const digits = contact.phoneNumber?.replace(/\D/g, "") || "";
        if (!contact.name || digits.length < 8 || digits.length > 15) {
          skipped++;
          continue;
        }
        const result = await inboxStore.ensureContactConversation({
          workspaceId: this.tenantId,
          name: contact.name,
          phoneNumber: contact.phoneNumber,
          tags: contact.tags || ["Imported CSV"],
          customAttributes: contact.company ? { company: contact.company } : {},
        });
        if (result.created) created++;
        else skipped++;
      }
      return { created, skipped };
    }
    let created = 0;
    let skipped = 0;

    for (const c of contacts) {
      if (!c.phoneNumber || !c.name) {
        skipped++;
        continue;
      }
      const rawDigits = c.phoneNumber.replace(/\D/g, "");
      const exists = this.localState.conversations.some((conv) => conv.contact.waId === rawDigits);
      if (exists) {
        skipped++;
        continue;
      }

      await this.createContact({
        name: c.name,
        phoneNumber: c.phoneNumber,
        tags: c.tags || ["Imported CSV"],
        customAttributes: c.company ? { company: c.company } : {},
      });
      created++;
    }

    return { created, skipped };
  }

  /**
   * Fetches approved HSM message templates
   */
  public async getTemplates(): Promise<MessageTemplate[]> {
    if (isDurableInboxEnabled()) {
      let connection;
      try {
        connection = await getMetaConnectionForWorkspace(this.tenantId);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("No connected WhatsApp Business Account")) return [];
        throw error;
      }
      const templates = await new MetaGraphClient(connection.accessToken).getTemplates(connection.wabaId);
      return templates.map((template) => ({
        id: template.id,
        metaTemplateId: String(template.id),
        name: template.name,
        language: template.language,
        category: template.category,
        status: template.status,
        components: template.components || [],
      }));
    }
    return this.localState.templates;
  }

  public async createTemplate(template: Omit<MessageTemplate, "id">): Promise<MessageTemplate> {
    if (isDurableInboxEnabled()) return { ...template, id: template.metaTemplateId };
    const created = { ...template, id: Date.now() };
    this.localState.templates.push(created);
    return created;
  }
}

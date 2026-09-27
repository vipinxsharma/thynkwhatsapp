import {
  initialConversations,
  initialMessages,
  initialWABA,
  sampleTemplates,
} from "./mock-data";
import { Contact, Conversation, Message, MessageTemplate, WABAAccount } from "@/types/strapi";

const STRAPI_URL = process.env.STRAPI_INTERNAL_URL || "http://localhost:1337";
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

// Local in-memory state for development and testing
let localConversations: Conversation[] = [...initialConversations];
let localMessages: Record<string, Message[]> = { ...initialMessages };
let localWABA: WABAAccount = { ...initialWABA };
let localTemplates: MessageTemplate[] = [...sampleTemplates];

export class StrapiClient {
  private tenantId?: string;

  constructor(tenantId?: string) {
    this.tenantId = tenantId || "1";
  }

  /**
   * Fetches active WABA account information for the current tenant
   */
  public async getWABA(): Promise<WABAAccount> {
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
    return localWABA;
  }

  /**
   * Fetches all conversations scoped to the tenant
   */
  public async getConversations(): Promise<Conversation[]> {
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
    return localConversations;
  }

  /**
   * Fetches message history for a conversation
   */
  public async getMessages(conversationId: string | number): Promise<Message[]> {
    const convIdStr = String(conversationId);
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
    return localMessages[convIdStr] || [];
  }

  /**
   * Appends an outbound or inbound message to the conversation
   */
  public async recordMessage(
    conversationId: string | number,
    message: Omit<Message, "id">
  ): Promise<Message> {
    const convIdStr = String(conversationId);
    const newId = Date.now();
    const createdMessage: Message = {
      ...message,
      id: newId,
      conversationId: convIdStr,
    };

    if (!localMessages[convIdStr]) {
      localMessages[convIdStr] = [];
    }
    localMessages[convIdStr].push(createdMessage);

    // Update conversation last message & timestamp
    const convIndex = localConversations.findIndex((c) => String(c.id) === convIdStr);
    if (convIndex !== -1) {
      localConversations[convIndex].lastMessage = createdMessage;
      localConversations[convIndex].lastMessageAt = createdMessage.timestamp;
      if (createdMessage.direction === "inbound") {
        // Refresh the 24h window
        localConversations[convIndex].windowExpiresAt = new Date(
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
    for (const messages of Object.values(localMessages)) {
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
    for (const conv of localConversations) {
      if (String(conv.contact.id) === String(contactId)) {
        conv.contact.tags = tags;
      }
    }
  }

  /**
   * Fetches all contacts
   */
  public async getContacts(): Promise<Contact[]> {
    const contactsMap = new Map<string, Contact>();
    for (const conv of localConversations) {
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
  }): Promise<{ contact: Contact; conversation: Conversation }> {
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

    const newConvId = localConversations.length + 1;
    const newConv: Conversation = {
      id: newConvId,
      status: "open",
      // Initially, 24h window starts expired if initiated by business without an incoming user message
      windowExpiresAt: new Date(Date.now() - 1000).toISOString(),
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
      contact: newContact,
      phoneNumber: localWABA.phoneNumbers?.[0] || {
        id: 1,
        phoneNumberId: "105678234901234",
        displayPhoneNumber: "+91 98765 43210",
        verifiedName: "thynkWISE Sales & Support",
        qualityRating: "GREEN",
        codeVerificationStatus: "VERIFIED",
      },
    };

    localConversations.unshift(newConv);
    localMessages[String(newConvId)] = [];

    return { contact: newContact, conversation: newConv };
  }

  /**
   * Updates an existing contact
   */
  public async updateContact(
    contactId: string | number,
    data: Partial<Contact>
  ): Promise<Contact | null> {
    let updatedContact: Contact | null = null;
    for (const conv of localConversations) {
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
    const initialLength = localConversations.length;
    localConversations = localConversations.filter(
      (c) => String(c.contact.id) !== String(contactId)
    );
    return localConversations.length < initialLength;
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
    let created = 0;
    let skipped = 0;

    for (const c of contacts) {
      if (!c.phoneNumber || !c.name) {
        skipped++;
        continue;
      }
      const rawDigits = c.phoneNumber.replace(/\D/g, "");
      const exists = localConversations.some((conv) => conv.contact.waId === rawDigits);
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
    return localTemplates;
  }
}

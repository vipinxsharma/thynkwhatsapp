import {
  initialConversations,
  initialMessages,
  initialWABA,
  sampleTemplates,
} from "./mock-data";
import { Conversation, Message, MessageTemplate, WABAAccount } from "@/types/strapi";

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
   * Fetches approved HSM message templates
   */
  public async getTemplates(): Promise<MessageTemplate[]> {
    return localTemplates;
  }
}

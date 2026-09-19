/**
 * TypeScript definitions for thynkWISE CRM and Strapi Entities
 */

export interface Tenant {
  id: number | string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "trial";
  plan: "starter" | "growth" | "enterprise";
  createdAt: string;
  updatedAt: string;
}

export interface WABAAccount {
  id: number | string;
  wabaId: string;
  name: string;
  currency: string;
  timezoneId: string;
  accountReviewStatus: "APPROVED" | "PENDING" | "REJECTED" | "SUSPENDED";
  webhookSubscribed: boolean;
  phoneNumbers?: PhoneNumber[];
  tenant?: Tenant;
}

export interface PhoneNumber {
  id: number | string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
  qualityRating: "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
  codeVerificationStatus: "VERIFIED" | "NOT_VERIFIED";
  waba?: WABAAccount;
}

export interface Contact {
  id: number | string;
  waId: string;
  phoneNumber: string;
  name: string;
  tags: string[];
  customAttributes: Record<string, any>;
  lastSeenAt?: string;
  tenantId?: string;
}

export interface Conversation {
  id: number | string;
  status: "open" | "pending" | "closed";
  windowExpiresAt: string; // ISO 8601 string
  lastMessageAt: string;
  unreadCount: number;
  contact: Contact;
  phoneNumber: PhoneNumber;
  assignedAgent?: {
    id: number | string;
    username: string;
    email: string;
  };
  lastMessage?: Message;
}

export interface Message {
  id: number | string;
  wamId: string;
  direction: "inbound" | "outbound";
  type:
    | "text"
    | "image"
    | "audio"
    | "video"
    | "document"
    | "location"
    | "interactive"
    | "template"
    | "reaction";
  body: string;
  rawPayload?: Record<string, any>;
  status: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
  errorCode?: string;
  errorMessage?: string;
  timestamp: string;
  conversationId?: number | string;
}

export interface MessageTemplate {
  id: number | string;
  metaTemplateId: string;
  name: string;
  language: string;
  category: "AUTHENTICATION" | "MARKETING" | "UTILITY";
  status: "APPROVED" | "IN_APPEAL" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED";
  components: Array<{
    type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
    format?: "TEXT" | "IMAGE" | "DOCUMENT" | "VIDEO";
    text?: string;
    buttons?: Array<{
      type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
      text: string;
      url?: string;
      phone_number?: string;
    }>;
  }>;
}

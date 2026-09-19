/**
 * Type definitions for Meta WhatsApp Business Cloud API Webhooks
 * Specification reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
 */

export interface MetaWebhookPayload {
  object: "whatsapp_business_account" | string;
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string; // WABA ID
  changes: WebhookChange[];
}

export interface WebhookChange {
  field: "messages" | "message_template_status_update" | string;
  value: WebhookChangeValue;
}

export interface WebhookChangeValue {
  messaging_product: "whatsapp";
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WebhookContact[];
  messages?: WebhookMessage[];
  statuses?: WebhookStatus[];
  errors?: WebhookError[];
  // For template status updates
  event?: "APPROVED" | "REJECTED" | "PAUSED" | "DISABLED" | "PENDING_DELETION";
  message_template_id?: string;
  message_template_name?: string;
  message_template_language?: string;
  reason?: string;
}

export interface WebhookContact {
  profile: {
    name: string;
  };
  wa_id: string; // E.164 without plus, e.g. "16505551234"
}

export type WebhookMessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "location"
  | "contacts"
  | "interactive"
  | "button"
  | "reaction"
  | "sticker"
  | "order"
  | "system"
  | "unsupported";

export interface WebhookMessage {
  from: string; // Customer wa_id
  id: string; // Meta message ID (wamid.HBgL...)
  timestamp: string; // Unix timestamp in seconds
  type: WebhookMessageType;
  text?: {
    body: string;
  };
  image?: WebhookMedia;
  audio?: WebhookMedia;
  video?: WebhookMedia;
  document?: WebhookMedia & { filename?: string };
  interactive?: {
    type: "button_reply" | "list_reply";
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
  button?: {
    text: string;
    payload: string;
  };
  reaction?: {
    message_id: string;
    emoji: string;
  };
  context?: {
    forwarded?: boolean;
    frequently_forwarded?: boolean;
    from?: string;
    id?: string; // Replied-to wamid
  };
  errors?: WebhookError[];
}

export interface WebhookMedia {
  id: string; // Meta media ID
  mime_type: string;
  sha256?: string;
  caption?: string;
}

export interface WebhookStatus {
  id: string; // wamid
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  pricing?: {
    billable: boolean;
    pricing_model: "CBP" | string;
    category: "authentication" | "marketing" | "utility" | "service";
  };
  conversation?: {
    id: string;
    expiration_timestamp?: string;
    origin?: {
      type: "user_initiated" | "business_initiated" | "referral_conversion";
    };
  };
  errors?: WebhookError[];
}

export interface WebhookError {
  code: number;
  title: string;
  message?: string;
  error_data?: {
    details: string;
  };
}

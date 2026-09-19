/**
 * Type definitions for Meta Graph API calls (WhatsApp Cloud API)
 */

export interface MetaTokenExchangeResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface MetaDebugTokenResponse {
  data: {
    app_id: string;
    type: string;
    application: string;
    data_access_expires_at: number;
    expires_at: number;
    is_valid: boolean;
    scopes: string[];
    user_id: string;
    granular_scopes?: {
      scope: string;
      target_ids?: string[];
    }[];
  };
}

export interface MetaSendMessagePayload {
  messaging_product: "whatsapp";
  recipient_type?: "individual";
  to: string; // E.164 without +, e.g. "16505551234"
  type: "text" | "template" | "image" | "document" | "interactive";
  text?: {
    preview_url?: boolean;
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: MetaTemplateComponentValue[];
  };
}

export interface MetaTemplateComponentValue {
  type: "header" | "body" | "button";
  sub_type?: "quick_reply" | "url";
  index?: string;
  parameters: {
    type: "text" | "currency" | "date_time" | "image" | "document";
    text?: string;
    image?: { link: string };
  }[];
}

export interface MetaSendMessageResponse {
  messaging_product: "whatsapp";
  contacts: [
    {
      input: string;
      wa_id: string;
    }
  ];
  messages: [
    {
      id: string; // wamid
    }
  ];
}

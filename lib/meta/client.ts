import {
  MetaSendMessagePayload,
  MetaSendMessageResponse,
  MetaTokenExchangeResponse,
} from "@/types/meta-api";

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
const GRAPH_API_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export class MetaGraphClient {
  private accessToken: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken || process.env.META_SYSTEM_USER_TOKEN || "";
  }

  /**
   * Exchanges an authorization code from Meta Embedded Signup for a Permanent System User Token
   */
  public static async exchangeCodeForToken(code: string): Promise<MetaTokenExchangeResponse> {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error("Missing NEXT_PUBLIC_META_APP_ID or META_APP_SECRET in environment");
    }

    const url = `${GRAPH_API_BASE_URL}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`;

    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to exchange code with Meta Graph API: ${errorText}`);
    }

    return (await res.json()) as MetaTokenExchangeResponse;
  }

  /**
   * Subscribes the thynkWISE Tech Provider app to receive Webhook notifications for the client's WABA
   */
  public async subscribeWabaToWebhook(wabaId: string): Promise<{ success: boolean }> {
    const url = `${GRAPH_API_BASE_URL}/${wabaId}/subscribed_apps`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Failed to subscribe WABA ${wabaId} to webhooks: ${error}`);
    }

    return (await res.json()) as { success: boolean };
  }

  /**
   * Sends a message (text, media, template) to a recipient via Meta Cloud API
   */
  public async sendMessage(
    phoneNumberId: string,
    payload: MetaSendMessagePayload
  ): Promise<MetaSendMessageResponse> {
    // If in demo/local mode without live Meta token, return mock response
    if (!this.accessToken || this.accessToken.startsWith("mock_")) {
      console.log("[Meta Client Mock] Sending message via Mock WhatsApp Cloud API:", payload);
      return {
        messaging_product: "whatsapp",
        contacts: [{ input: payload.to, wa_id: payload.to }],
        messages: [{ id: `wamid.MOCK_${Date.now()}_${Math.random().toString(36).substring(7)}` }],
      };
    }

    const url = `${GRAPH_API_BASE_URL}/${phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(
        `Meta Cloud API send message error: ${error?.error?.message || JSON.stringify(error)}`
      );
    }

    return (await res.json()) as MetaSendMessageResponse;
  }

  /**
   * Fetches approved HSM message templates from the WABA
   */
  public async getTemplates(wabaId: string): Promise<any[]> {
    if (!this.accessToken || this.accessToken.startsWith("mock_")) {
      return [
        {
          id: "tpl_101",
          name: "order_confirmation_v1",
          language: "en_US",
          status: "APPROVED",
          category: "UTILITY",
          components: [
            { type: "HEADER", format: "TEXT", text: "Order Confirmed!" },
            {
              type: "BODY",
              text: "Hi {{1}}, your order #{{2}} of {{3}} is confirmed. Track it here: {{4}}",
            },
            { type: "FOOTER", text: "thynkWISE Commerce" },
            {
              type: "BUTTONS",
              buttons: [{ type: "URL", text: "Track Order", url: "https://thynkwise.co.in/orders" }],
            },
          ],
        },
        {
          id: "tpl_102",
          name: "lead_reactivation_promo",
          language: "en_US",
          status: "APPROVED",
          category: "MARKETING",
          components: [
            { type: "HEADER", format: "TEXT", text: "Exclusive 25% Off Deal" },
            {
              type: "BODY",
              text: "Hello {{1}}, we noticed you were exploring our Enterprise plan. Use code SAVE25 today to get started!",
            },
            {
              type: "BUTTONS",
              buttons: [{ type: "QUICK_REPLY", text: "Chat with Sales" }],
            },
          ],
        },
      ];
    }

    const url = `${GRAPH_API_BASE_URL}/${wabaId}/message_templates?limit=100`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch templates from WABA ${wabaId}`);
    }

    const data = await res.json();
    return data.data || [];
  }
}

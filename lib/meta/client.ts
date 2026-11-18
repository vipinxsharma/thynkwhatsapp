import crypto from "node:crypto";
import {
  MetaDebugTokenResponse,
  MetaSendMessagePayload,
  MetaSendMessageResponse,
  MetaTokenExchangeResponse,
} from "@/types/meta-api";

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v27.0";
const GRAPH_API_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function metaMocksEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_META_MOCKS === "true";
}

/** Meta's own error message, without echoing request URLs (which can carry the app secret). */
async function describeMetaError(res: Response): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: { message?: string; code?: number; error_subcode?: number } };
    const error = payload?.error;
    if (error?.message) {
      const code = [error.code, error.error_subcode].filter((part) => part !== undefined).join("/");
      return code ? `${error.message} (code ${code})` : error.message;
    }
  } catch {
    // fall through to the status line
  }
  return `HTTP ${res.status}`;
}

/** Meta answered a send request with an error. `code` is Meta's error code when it gave one. */
export class MetaSendError extends Error {
  constructor(message: string, public readonly httpStatus: number, public readonly code: number | null) {
    super(message);
    this.name = "MetaSendError";
  }
}

export interface MetaTokenState {
  isValid: boolean;
  expiresAt: Date | null;
  wabaIds: string[];
}

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

    // Meta documents this exchange as a GET; keep the secret out of logs and encode every value.
    const query = new URLSearchParams({ client_id: appId, client_secret: appSecret, code });
    const res = await fetch(`${GRAPH_API_BASE_URL}/oauth/access_token?${query}`, { method: "GET" });
    if (!res.ok) {
      throw new Error(`Meta rejected the signup code: ${await describeMetaError(res)}`);
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
      throw new Error(`Failed to subscribe WABA ${wabaId} to webhooks: ${await describeMetaError(res)}`);
    }

    return (await res.json()) as { success: boolean };
  }

  /**
   * Reads a business token's own state from Meta: validity, expiry and the WhatsApp
   * Business accounts it was granted. `expiresAt` is null for a token that never expires.
   */
  public async inspectToken(): Promise<MetaTokenState> {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error("Missing NEXT_PUBLIC_META_APP_ID or META_APP_SECRET in environment");
    }
    if (!this.accessToken) throw new Error("A live Meta access token is required");
    const query = new URLSearchParams({ input_token: this.accessToken });
    const res = await fetch(`${GRAPH_API_BASE_URL}/debug_token?${query}`, {
      headers: { Authorization: `Bearer ${appId}|${appSecret}` },
    });
    if (!res.ok) throw new Error(`Unable to inspect the Meta token: ${await describeMetaError(res)}`);
    const payload = (await res.json()) as MetaDebugTokenResponse;
    const ids = new Set<string>();
    for (const grant of payload.data?.granular_scopes || []) {
      if (grant.scope !== "whatsapp_business_management" && grant.scope !== "whatsapp_business_messaging") continue;
      for (const id of grant.target_ids || []) if (/^\d{5,30}$/.test(String(id))) ids.add(String(id));
    }
    const expiresAt = Number(payload.data?.expires_at);
    return {
      isValid: payload.data?.is_valid === true,
      expiresAt: Number.isFinite(expiresAt) && expiresAt > 0 ? new Date(expiresAt * 1000) : null,
      wabaIds: [...ids],
    };
  }

  /**
   * Lists the WhatsApp Business accounts a customer's business token was granted, read from
   * the token itself. Used when Meta returns a code without the Embedded Signup session event.
   */
  public async listGrantedWabaIds(): Promise<string[]> {
    return (await this.inspectToken()).wabaIds;
  }

  /**
   * Issues a fresh 60-day business token from the current one, using Meta's
   * `/<CLIENT_BUSINESS_ID>/system_user_access_tokens` endpoint. The current token must
   * still be valid; an expired token cannot be refreshed and the customer must reconnect.
   */
  public async refreshBusinessToken(): Promise<string> {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) throw new Error("Missing META_APP_SECRET in environment");
    if (!this.accessToken) throw new Error("A live Meta access token is required");
    const headers = { Authorization: `Bearer ${this.accessToken}` };

    const me = await fetch(`${GRAPH_API_BASE_URL}/me?fields=client_business_id`, { headers });
    if (!me.ok) throw new Error(`Unable to read the client business: ${await describeMetaError(me)}`);
    const clientBusinessId = String(((await me.json()) as { client_business_id?: unknown }).client_business_id || "");
    if (!/^\d{5,30}$/.test(clientBusinessId)) throw new Error("Meta did not return a client business ID for this token");

    const body = new URLSearchParams({
      appsecret_proof: crypto.createHmac("sha256", appSecret).update(this.accessToken).digest("hex"),
      set_token_expires_in_60_days: "true",
    });
    const res = await fetch(`${GRAPH_API_BASE_URL}/${clientBusinessId}/system_user_access_tokens`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`Meta did not issue a new token: ${await describeMetaError(res)}`);
    const token = ((await res.json()) as { access_token?: unknown }).access_token;
    if (typeof token !== "string" || !token) throw new Error("Meta returned no access token");
    return token;
  }

  /**
   * Reads whether a business phone number is already registered for Cloud API use.
   */
  public async getPhoneRegistration(phoneNumberId: string): Promise<{ registered: boolean; status?: string; platformType?: string }> {
    if (!this.accessToken) throw new Error("A live Meta access token is required");
    const res = await fetch(`${GRAPH_API_BASE_URL}/${phoneNumberId}?fields=status,platform_type`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) throw new Error(`Unable to read the phone number from Meta: ${await describeMetaError(res)}`);
    const phone = (await res.json()) as { status?: string; platform_type?: string };
    return {
      registered: phone.platform_type === "CLOUD_API" && phone.status === "CONNECTED",
      status: phone.status,
      platformType: phone.platform_type,
    };
  }

  /**
   * Registers a customer's business phone number for Cloud API use (Tech Provider onboarding step 3).
   * The PIN becomes the number's two-step verification PIN.
   */
  public async registerPhoneNumber(phoneNumberId: string, pin: string): Promise<void> {
    if (!this.accessToken) throw new Error("A live Meta access token is required");
    if (!/^\d{6}$/.test(pin)) throw new Error("The registration PIN must be 6 digits");
    const res = await fetch(`${GRAPH_API_BASE_URL}/${phoneNumberId}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.accessToken}` },
      body: JSON.stringify({ messaging_product: "whatsapp", pin }),
    });
    if (!res.ok) throw new Error(`Meta could not register the phone number: ${await describeMetaError(res)}`);
    const payload = (await res.json()) as { success?: boolean };
    if (!payload.success) throw new Error("Meta did not confirm phone number registration");
  }

  public async verifyPhoneOwnership(
    wabaId: string,
    phoneNumberId: string
  ): Promise<{ displayPhoneNumber?: string; verifiedName?: string }> {
    if (!this.accessToken) throw new Error("A live Meta access token is required");
    const url = `${GRAPH_API_BASE_URL}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&limit=100`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    if (!res.ok) throw new Error("Unable to verify WABA phone-number ownership with Meta");
    const payload = await res.json();
    const phone = payload.data?.find((item: { id: string }) => String(item.id) === phoneNumberId);
    if (!phone) throw new Error("The selected phone number does not belong to this WABA");
    return { displayPhoneNumber: phone.display_phone_number, verifiedName: phone.verified_name };
  }

  public async listPhoneNumbers(wabaId: string): Promise<Array<{
    id: string; display_phone_number?: string; verified_name?: string;
    quality_rating?: string; code_verification_status?: string;
  }>> {
    if (!this.accessToken) throw new Error("A live Meta access token is required");
    const url = `${GRAPH_API_BASE_URL}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status&limit=100`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    if (!res.ok) throw new Error("Unable to read WABA phone numbers from Meta");
    const payload = await res.json();
    if (!Array.isArray(payload.data)) throw new Error("Meta returned an invalid phone-number inventory");
    return payload.data;
  }

  /**
   * Sends a message (text, media, template) to a recipient via Meta Cloud API
   */
  public async sendMessage(
    phoneNumberId: string,
    payload: MetaSendMessagePayload
  ): Promise<MetaSendMessageResponse> {
    if (!this.accessToken || this.accessToken.startsWith("mock_")) {
      if (!metaMocksEnabled()) {
        throw new Error("A live Meta access token is required; mock delivery is disabled");
      }
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
      const error = await res.json().catch(() => null);
      throw new MetaSendError(
        `Meta Cloud API send message error: ${error?.error?.message || JSON.stringify(error)}`,
        res.status,
        Number.isFinite(Number(error?.error?.code)) ? Number(error.error.code) : null
      );
    }

    return (await res.json()) as MetaSendMessageResponse;
  }

  /**
   * Uploads a media file to the sender number's media store and returns Meta's media ID.
   * The ID is what a later image/video/document send references; it stays valid for 30 days.
   */
  public async uploadMedia(
    phoneNumberId: string,
    file: { bytes: Blob; mimeType: string; filename: string }
  ): Promise<{ id: string }> {
    if (!this.accessToken) throw new Error("A live Meta access token is required");
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", file.mimeType);
    form.append("file", file.bytes, file.filename);
    const res = await fetch(`${GRAPH_API_BASE_URL}/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Meta could not accept the file: ${await describeMetaError(res)}`);
    const payload = (await res.json()) as { id?: unknown };
    if (typeof payload.id !== "string" || !/^\d{5,30}$/.test(payload.id)) {
      throw new Error("Meta did not return a media ID");
    }
    return { id: payload.id };
  }

  /**
   * Streams a media file stored by Meta. Meta issues a short-lived download URL for the media ID;
   * the bytes themselves also require the access token.
   */
  public async fetchMedia(mediaId: string): Promise<{ body: ReadableStream<Uint8Array>; mimeType: string; contentLength: number | null }> {
    if (!this.accessToken) throw new Error("A live Meta access token is required");
    if (!/^\d{5,30}$/.test(mediaId)) throw new Error("Invalid media ID");
    const headers = { Authorization: `Bearer ${this.accessToken}` };
    const lookup = await fetch(`${GRAPH_API_BASE_URL}/${mediaId}`, { headers });
    if (!lookup.ok) throw new Error(`Meta could not locate the media: ${await describeMetaError(lookup)}`);
    const meta = (await lookup.json()) as { url?: unknown; mime_type?: unknown };
    if (typeof meta.url !== "string" || !meta.url.startsWith("https://")) {
      throw new Error("Meta returned no download URL for this media");
    }
    const download = await fetch(meta.url, { headers });
    if (!download.ok || !download.body) throw new Error(`Meta could not download the media (HTTP ${download.status})`);
    const length = Number(download.headers.get("content-length"));
    return {
      body: download.body,
      mimeType: typeof meta.mime_type === "string" ? meta.mime_type : "application/octet-stream",
      contentLength: Number.isFinite(length) && length > 0 ? length : null,
    };
  }

  /**
   * Fetches approved HSM message templates from the WABA
   */
  public async getTemplates(wabaId: string): Promise<any[]> {
    if (!this.accessToken || this.accessToken.startsWith("mock_")) {
      if (!metaMocksEnabled()) {
        throw new Error("A live Meta access token is required; mock templates are disabled");
      }
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

  public async createTemplate(
    wabaId: string,
    template: { name: string; language: string; category: string; components: unknown[] }
  ): Promise<{ id: string; status?: string; category?: string }> {
    if (!this.accessToken) throw new Error("A live Meta access token is required");
    const res = await fetch(`${GRAPH_API_BASE_URL}/${wabaId}/message_templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(template),
    });
    if (!res.ok) {
      const payload = await res.json();
      throw new Error(payload?.error?.message || "Meta rejected the template submission");
    }
    return res.json();
  }
}

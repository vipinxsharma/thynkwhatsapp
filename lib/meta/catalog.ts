import crypto from "node:crypto";

/**
 * Graph API wrapper for Meta commerce catalogs. Every call here is a live Meta write or read;
 * callers decide when to make them (see lib/meta/catalog-sync.ts for the dry-run/live gate).
 */

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v27.0";
const GRAPH_API_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/** Meta's own error message, without echoing request URLs (which can carry the app secret). Same as client.ts. */
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

export interface CatalogItemData {
  name: string;
  description: string;
  /** Meta price string, e.g. "499.00 INR". */
  price: string;
  currency: "INR";
  availability: "in stock" | "out of stock";
  image_link: string;
  url?: string;
}

export interface CatalogItemRequest {
  method: "UPDATE";
  retailer_id: string;
  data: CatalogItemData;
}

export interface CatalogItemsBatchResult {
  handles: string[];
}

function appSecretProof(accessToken: string): string {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) throw new Error("Missing META_APP_SECRET in environment");
  return crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

export class MetaCatalogClient {
  private accessToken: string;

  constructor(accessToken: string) {
    if (!accessToken) throw new Error("A live Meta access token is required");
    this.accessToken = accessToken;
  }

  /** Reads the business that owns this token (`client_business_id`), needed to create a catalog. */
  public async readClientBusinessId(): Promise<string> {
    const res = await fetch(`${GRAPH_API_BASE_URL}/me?fields=client_business_id`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) throw new Error(`Unable to read the client business: ${await describeMetaError(res)}`);
    const id = String(((await res.json()) as { client_business_id?: unknown }).client_business_id || "");
    if (!/^\d{5,30}$/.test(id)) throw new Error("Meta did not return a client business ID for this token");
    return id;
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/x-www-form-urlencoded" };
  }

  /**
   * Creates a commerce catalog owned by the business (Commerce Manager catalog).
   * Edge: POST /{business_id}/owned_product_catalogs with name and vertical "commerce".
   */
  public async createCommerceCatalog(businessId: string, name: string): Promise<{ id: string }> {
    if (!/^\d{5,30}$/.test(businessId)) throw new Error("Invalid business ID");
    const body = new URLSearchParams({
      name,
      vertical: "commerce",
      appsecret_proof: appSecretProof(this.accessToken),
    });
    const res = await fetch(`${GRAPH_API_BASE_URL}/${businessId}/owned_product_catalogs`, {
      method: "POST",
      headers: this.headers(),
      body,
    });
    if (!res.ok) throw new Error(`Meta could not create the catalog: ${await describeMetaError(res)}`);
    const payload = (await res.json()) as { id?: unknown };
    if (typeof payload.id !== "string" || !/^\d{5,30}$/.test(payload.id)) {
      throw new Error("Meta did not return a catalog ID");
    }
    return { id: payload.id };
  }

  /**
   * Links a catalog to the WhatsApp Business Account so WhatsApp can show it.
   * Edge: POST /{waba_id}/product_catalogs with catalog_id (the WABA's product_catalogs edge).
   * Requires whatsapp_business_management on the token.
   */
  public async connectCatalogToWaba(wabaId: string, catalogId: string): Promise<void> {
    if (!/^\d{5,30}$/.test(wabaId) || !/^\d{5,30}$/.test(catalogId)) throw new Error("Invalid WABA or catalog ID");
    const body = new URLSearchParams({
      catalog_id: catalogId,
      appsecret_proof: appSecretProof(this.accessToken),
    });
    const res = await fetch(`${GRAPH_API_BASE_URL}/${wabaId}/product_catalogs`, {
      method: "POST",
      headers: this.headers(),
      body,
    });
    if (!res.ok) throw new Error(`Meta could not link the catalog to the WhatsApp account: ${await describeMetaError(res)}`);
  }

  /**
   * Sends one batch of item updates. Edge: POST /{catalog_id}/items_batch.
   * Meta caps batch size; callers must chunk (see chunkItems in catalog-sync.ts).
   * Items are updated in place; this never deletes.
   */
  public async sendItemsBatch(catalogId: string, requests: CatalogItemRequest[]): Promise<CatalogItemsBatchResult> {
    if (!/^\d{5,30}$/.test(catalogId)) throw new Error("Invalid catalog ID");
    if (requests.length === 0) return { handles: [] };
    const body = new URLSearchParams({
      item_type: "PRODUCT_ITEM",
      requests: JSON.stringify(requests),
      appsecret_proof: appSecretProof(this.accessToken),
    });
    const res = await fetch(`${GRAPH_API_BASE_URL}/${catalogId}/items_batch`, {
      method: "POST",
      headers: this.headers(),
      body,
    });
    if (!res.ok) throw new Error(`Meta rejected the catalog batch: ${await describeMetaError(res)}`);
    const payload = (await res.json()) as { handles?: unknown };
    return { handles: Array.isArray(payload.handles) ? payload.handles.map(String) : [] };
  }
}

import { adsGraphVersion, ADS_READ_SCOPE } from "./oauth";

// Calls to the Meta Graph API for the ads connection. Tokens travel in the Authorization header,
// never in a URL, and error messages never echo request URLs (those can carry the app secret).

export class AdsGraphError extends Error {
  constructor(message: string, public readonly httpStatus: number) {
    super(message);
    this.name = "AdsGraphError";
  }
}

function graphBase(): string {
  return `https://graph.facebook.com/${adsGraphVersion()}`;
}

async function describeMetaError(res: Response): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: { message?: string; code?: number } };
    if (payload?.error?.message) {
      return payload.error.code ? `${payload.error.message} (code ${payload.error.code})` : payload.error.message;
    }
  } catch {
    // fall through to the status line
  }
  return `HTTP ${res.status}`;
}

async function graphGet<T>(path: string, accessToken: string | null, query: Record<string, string> = {}): Promise<T> {
  const url = `${graphBase()}${path}${Object.keys(query).length ? `?${new URLSearchParams(query)}` : ""}`;
  const res = await fetch(url, {
    method: "GET",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    cache: "no-store",
  });
  if (!res.ok) throw new AdsGraphError(`Meta rejected the request: ${await describeMetaError(res)}`, res.status);
  return (await res.json()) as T;
}

/** Exchanges the authorization code for a user access token. The secret travels in the query, as Meta documents. */
export async function exchangeAdsCode(input: {
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; expiresIn: number | null }> {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error("Missing NEXT_PUBLIC_META_APP_ID or META_APP_SECRET in environment");

  const data = await graphGet<{ access_token?: unknown; expires_in?: unknown }>(
    "/oauth/access_token",
    null,
    { client_id: appId, client_secret: appSecret, redirect_uri: input.redirectUri, code: input.code },
  );
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new AdsGraphError("Meta did not return an access token", 502);
  }
  const expiresIn = typeof data.expires_in === "number" && data.expires_in > 0 ? data.expires_in : null;
  return { accessToken: data.access_token, expiresIn };
}

/**
 * Confirms the user is known and that ads_read was granted. Returns false when it is not granted,
 * so the connection is never stored on a partial grant.
 */
export async function fetchAdsGrant(accessToken: string): Promise<{ metaUserId: string; adsReadGranted: boolean }> {
  const me = await graphGet<{ id?: unknown }>("/me", accessToken, { fields: "id" });
  if (typeof me.id !== "string" || !/^\d{1,30}$/.test(me.id)) {
    throw new AdsGraphError("Meta did not return the user id", 502);
  }
  const permissions = await graphGet<{ data?: Array<{ permission?: unknown; status?: unknown }> }>(
    "/me/permissions",
    accessToken,
  );
  const adsReadGranted = (permissions.data || []).some(
    (entry) => entry.permission === ADS_READ_SCOPE && entry.status === "granted",
  );
  return { metaUserId: me.id, adsReadGranted };
}

export type AdAccountSummary = { id: string; name: string; accountStatus: string };

/** The ad accounts the user can read. One page of up to 100 accounts; the connection screen says so. */
export async function fetchAdAccounts(accessToken: string): Promise<AdAccountSummary[]> {
  const data = await graphGet<{ data?: Array<{ id?: unknown; name?: unknown; account_status?: unknown }> }>(
    "/me/adaccounts",
    accessToken,
    { fields: "id,name,account_status", limit: "100" },
  );
  return (data.data || [])
    .filter((account) => typeof account.id === "string" && account.id.length > 0)
    .map((account) => ({
      id: String(account.id),
      name: typeof account.name === "string" ? account.name.slice(0, 200) : "",
      accountStatus: typeof account.account_status === "number" ? String(account.account_status) : "",
    }));
}

/** Removes only the ads_read grant at Meta. Returns false when Meta refuses, so the caller can report it. */
export async function revokeAdsRead(accessToken: string): Promise<boolean> {
  const res = await fetch(`${graphBase()}/me/permissions?${new URLSearchParams({ permission: ADS_READ_SCOPE })}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return res.ok;
}

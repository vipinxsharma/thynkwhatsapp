// Pure cookie-consent logic. No imports on purpose: this file is shared by the
// banner, the inline bootstrap script in app/layout.tsx, and the unit tests.

export const CONSENT_STORAGE_KEY = "xeccel_cookie_consent";
export const COOKIE_SETTINGS_EVENT = "xeccel:cookie-settings";
export const CONSENT_BANNER_HEIGHT_VAR = "--xc-cookie-h";

export type ConsentChoice = "accepted" | "rejected";

/** Google Consent Mode v2 signals. Every one starts denied and is only granted on Accept. */
export const CONSENT_SIGNALS = [
  "analytics_storage",
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
] as const;

/** Cookies set by Google analytics and ads tags. Expired on every Reject. */
export const TRACKING_COOKIE_NAMES = ["_ga", "_gid", "_gat", "ga"] as const;
export const TRACKING_COOKIE_PREFIXES = ["_ga_", "_gcl_"] as const;

/** Attribution storage keys. The repo has none today, so this list is empty by design. */
export const ATTRIBUTION_STORAGE_KEYS: readonly string[] = [];

/** Production cookie domain. Preview hosts (*.vercel.app) are public suffixes and get no Domain attribute. */
const PRODUCTION_REGISTRABLE_DOMAIN = "xeccel.com";

export function parseStoredChoice(raw: string | null | undefined): ConsentChoice | null {
  return raw === "accepted" || raw === "rejected" ? raw : null;
}

export function isTrackingCookieName(name: string): boolean {
  const trimmed = name.trim();
  return (
    (TRACKING_COOKIE_NAMES as readonly string[]).includes(trimmed) ||
    TRACKING_COOKIE_PREFIXES.some((prefix) => trimmed.startsWith(prefix))
  );
}

/**
 * Cookie Domain values to expire for a host. Always includes host-only (null).
 * Production (xeccel.com and subdomains) also gets the apex and leading-dot parent.
 */
export function cookieDomainsForHost(hostname: string): Array<string | null> {
  const host = hostname.toLowerCase();
  if (host === PRODUCTION_REGISTRABLE_DOMAIN || host.endsWith(`.${PRODUCTION_REGISTRABLE_DOMAIN}`)) {
    return [null, PRODUCTION_REGISTRABLE_DOMAIN, `.${PRODUCTION_REGISTRABLE_DOMAIN}`];
  }
  return [null];
}

export const EXPIRED_COOKIE_DATE = "Thu, 01 Jan 1970 00:00:00 GMT";

/** Exact expiry strings for one cookie name and one Domain value (null = host-only). */
export function expiryCookieString(name: string, domain: string | null): string {
  const domainPart = domain ? `Domain=${domain}; ` : "";
  return `${name}=; ${domainPart}Path=/; Expires=${EXPIRED_COOKIE_DATE}`;
}

/** Every expiry string needed for a hostname, given the cookie names currently present. */
export function expiryCookieStrings(hostname: string, cookieNames: readonly string[]): string[] {
  // document.cookie names carry a leading space after ";", so trim before matching and writing.
  const names = cookieNames.map((name) => name.trim()).filter(isTrackingCookieName);
  const domains = cookieDomainsForHost(hostname);
  const out: string[] = [];
  for (const name of names) {
    for (const domain of domains) out.push(expiryCookieString(name, domain));
  }
  return out;
}

/** Google consent payload. Accept grants all four signals; Reject denies all four. */
export function consentPayload(granted: boolean): Record<(typeof CONSENT_SIGNALS)[number], "granted" | "denied"> {
  const value = granted ? "granted" : "denied";
  return {
    analytics_storage: value,
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
  };
}

/**
 * Ordered Reject steps. Order matters: deny Google consent first so tags still
 * running cannot write new cookies, expire cookies second, clear attribution
 * third, and reload last (only if a gated script already ran in this tab).
 */
export const REJECT_STEPS = [
  "consent-update-denied",
  "expire-tracking-cookies",
  "clear-attribution",
  "reload-if-scripts-loaded",
] as const;

/**
 * Inline script that runs before any tag (beforeInteractive). It defines the
 * consent defaults as denied, then grants them only if the visitor already accepted.
 */
export function consentBootstrapScript(): string {
  const key = JSON.stringify(CONSENT_STORAGE_KEY);
  const denied = JSON.stringify(consentPayload(false));
  return [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){window.dataLayer.push(arguments);}",
    "window.gtag=window.gtag||gtag;",
    `gtag('consent','default',Object.assign(${denied},{wait_for_update:500}));`,
    "try{if(localStorage.getItem(" + key + ")==='accepted'){",
    `gtag('consent','update',${JSON.stringify(consentPayload(true))});`,
    "}}catch(e){}",
  ].join("");
}

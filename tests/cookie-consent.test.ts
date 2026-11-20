import { describe, expect, it } from "vitest";
import {
  CONSENT_SIGNALS,
  CONSENT_STORAGE_KEY,
  REJECT_STEPS,
  consentBootstrapScript,
  consentPayload,
  cookieDomainsForHost,
  expiryCookieString,
  expiryCookieStrings,
  isTrackingCookieName,
  metaPixelBaseCode,
  metaPixelId,
  parseStoredChoice,
} from "../components/consent/consentConfig";

describe("Meta Pixel ID", () => {
  it("accepts only numeric IDs and treats unset or malformed values as no pixel", () => {
    expect(metaPixelId("123456789012345")).toBe("123456789012345");
    expect(metaPixelId(" 123456789012345 ")).toBe("123456789012345");
    expect(metaPixelId("")).toBeNull();
    expect(metaPixelId("PASTE_PIXEL_ID")).toBeNull();
    expect(metaPixelId("12345")).toBeNull();
    expect(metaPixelId("1234567890'); alert(1);//")).toBeNull();
    expect(metaPixelId(undefined)).toBeNull();
  });

  it("base code loads fbevents.js, inits the ID, and tracks PageView, with no noscript fallback", () => {
    const code = metaPixelBaseCode("123456789012345");
    expect(code).toContain("https://connect.facebook.net/en_US/fbevents.js");
    expect(code).toContain("fbq('init',\"123456789012345\")");
    expect(code).toContain("fbq('track','PageView')");
    expect(code.indexOf("fbq('init'")).toBeGreaterThan(code.indexOf("fbevents.js"));
    expect(code).not.toContain("noscript");
  });
});

describe("cookie consent storage", () => {
  it("uses one localStorage key and only accepts the two known choices", () => {
    expect(CONSENT_STORAGE_KEY).toBe("xeccel_cookie_consent");
    expect(parseStoredChoice("accepted")).toBe("accepted");
    expect(parseStoredChoice("rejected")).toBe("rejected");
    expect(parseStoredChoice("maybe")).toBeNull();
    expect(parseStoredChoice(null)).toBeNull();
    expect(parseStoredChoice(undefined)).toBeNull();
  });
});

describe("Google consent signals", () => {
  it("covers the four Consent Mode signals and grants or denies them together", () => {
    expect([...CONSENT_SIGNALS]).toEqual(["analytics_storage", "ad_storage", "ad_user_data", "ad_personalization"]);
    expect(consentPayload(false)).toEqual({
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    expect(consentPayload(true)).toEqual({
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    });
  });

  it("bootstrap script sets every signal to denied before any tag and only grants on a stored accept", () => {
    const script = consentBootstrapScript();
    expect(script).toContain("gtag('consent','default',");
    expect(script).toContain('"analytics_storage":"denied"');
    expect(script).toContain('"ad_personalization":"denied"');
    expect(script).toContain(`localStorage.getItem("${CONSENT_STORAGE_KEY}")==='accepted'`);
    expect(script.indexOf("'consent','default'")).toBeLessThan(script.indexOf("'consent','update'"));
  });
});

describe("Reject order", () => {
  it("denies consent, then expires cookies, then clears attribution, then reloads last", () => {
    expect([...REJECT_STEPS]).toEqual([
      "consent-update-denied",
      "expire-tracking-cookies",
      "clear-attribution",
      "reload-if-scripts-loaded",
    ]);
  });
});

describe("tracking cookie expiry", () => {
  it("matches GA and Google Ads cookie names but not unrelated cookies", () => {
    for (const name of ["_ga", "_gid", "_gat", "ga", "_ga_ABC123", "_gcl_au", "_gcl_aw"]) {
      expect(isTrackingCookieName(name)).toBe(true);
    }
    for (const name of ["xeccel-theme", "session", "gaming_pref", "__Host-auth"]) {
      expect(isTrackingCookieName(name)).toBe(false);
    }
  });

  it("produces the exact expiry strings for host-only and parent-domain cookies", () => {
    expect(expiryCookieString("_ga", null)).toBe("_ga=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(expiryCookieString("_ga", "xeccel.com")).toBe(
      "_ga=; Domain=xeccel.com; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    );
    expect(expiryCookieString("_ga", ".xeccel.com")).toBe(
      "_ga=; Domain=.xeccel.com; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    );
  });

  it("expires host, apex and leading-dot parent for production and subdomains", () => {
    expect(cookieDomainsForHost("xeccel.com")).toEqual([null, "xeccel.com", ".xeccel.com"]);
    expect(cookieDomainsForHost("www.xeccel.com")).toEqual([null, "xeccel.com", ".xeccel.com"]);
  });

  it("gives preview hosts only the host-only expiry, never a public-suffix Domain", () => {
    expect(cookieDomainsForHost("xeccel-git-main.vercel.app")).toEqual([null]);
    expect(cookieDomainsForHost("localhost")).toEqual([null]);
    expect(expiryCookieStrings("xeccel-git-main.vercel.app", ["_ga"])).toEqual([
      "_ga=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ]);
  });

  it("builds the full expiry list for the cookies actually present", () => {
    expect(expiryCookieStrings("xeccel.com", ["xeccel-theme", "_ga", "_ga_ABC123"])).toEqual([
      "_ga=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "_ga=; Domain=xeccel.com; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "_ga=; Domain=.xeccel.com; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "_ga_ABC123=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "_ga_ABC123=; Domain=xeccel.com; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "_ga_ABC123=; Domain=.xeccel.com; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ]);
  });

  it("writes clean names for cookies whose names carry the leading space from document.cookie", () => {
    expect(expiryCookieStrings("xeccel.com", [" _ga", " xeccel-theme"])).toEqual([
      "_ga=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "_ga=; Domain=xeccel.com; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "_ga=; Domain=.xeccel.com; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ]);
  });

  it("never expires the theme preference cookie", () => {
    expect(expiryCookieStrings("xeccel.com", ["xeccel-theme"])).toEqual([]);
  });
});

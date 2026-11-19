"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ATTRIBUTION_STORAGE_KEYS,
  CONSENT_BANNER_HEIGHT_VAR,
  CONSENT_STORAGE_KEY,
  COOKIE_SETTINGS_EVENT,
  consentPayload,
  expiryCookieStrings,
  parseStoredChoice,
  type ConsentChoice,
} from "./consentConfig";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Gated tags. Nothing loads today: GA4, GTM and any other tag are added here, behind
 * the Accept branch only, once their IDs exist (NEXT_PUBLIC_GA_ID / NEXT_PUBLIC_GTM_ID).
 * Meta Pixel and Google Ads belong here too, behind the same accepted check.
 */
function loadOptionalTags(): boolean {
  return false;
}

let optionalTagsLoaded = false;

function readStoredChoice(): ConsentChoice | null {
  try {
    return parseStoredChoice(window.localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredChoice(choice: ConsentChoice) {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Storage blocked (private window, disabled site data): the banner reappears next visit.
  }
}

function clearAttribution() {
  for (const key of ATTRIBUTION_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore: storage unavailable
    }
  }
}

function expireTrackingCookies() {
  const names = document.cookie
    .split(";")
    .map((part) => part.split("=")[0] ?? "")
    .filter(Boolean);
  for (const line of expiryCookieStrings(window.location.hostname, names)) {
    document.cookie = line;
  }
}

function updateGoogleConsent(granted: boolean) {
  window.dataLayer = window.dataLayer || [];
  window.gtag?.("consent", "update", consentPayload(granted));
}

export default function CookieConsent() {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReady(true);
    if (readStoredChoice() === null) setOpen(true);

    const openSettings = () => setOpen(true);
    window.addEventListener(COOKIE_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, openSettings);
  }, []);

  // Keep --xc-cookie-h equal to the banner's real height and pad the page so footer links stay reachable.
  useEffect(() => {
    if (!open || !bannerRef.current) return;
    const el = bannerRef.current;
    const root = document.documentElement;
    const apply = () => {
      const height = `${el.getBoundingClientRect().height}px`;
      root.style.setProperty(CONSENT_BANNER_HEIGHT_VAR, height);
      document.body.style.paddingBottom = height;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
      root.style.removeProperty(CONSENT_BANNER_HEIGHT_VAR);
      document.body.style.removeProperty("padding-bottom");
    };
  }, [open]);

  function accept() {
    writeStoredChoice("accepted");
    updateGoogleConsent(true);
    if (loadOptionalTags()) optionalTagsLoaded = true;
    setOpen(false);
  }

  function reject() {
    // Order matters. See REJECT_STEPS in consentConfig.ts.
    writeStoredChoice("rejected");
    updateGoogleConsent(false);        // 1. deny Google consent first
    expireTrackingCookies();           // 2. expire tracking cookies for the host and parent domains
    clearAttribution();                // 3. clear attribution storage
    setOpen(false);
    if (optionalTagsLoaded) {          // 4. reload last, only if a gated script already ran in this tab
      window.location.reload();
    }
  }

  if (!ready || !open) return null;

  return (
    <div
      ref={bannerRef}
      id="xc-cookie-banner"
      role="dialog"
      aria-modal="false"
      aria-labelledby="xc-cookie-title"
      aria-describedby="xc-cookie-body"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-2xl"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <div className="max-w-3xl text-sm leading-6">
          <p id="xc-cookie-title" className="font-semibold text-[var(--heading)]">Cookies on Xeccel</p>
          <p id="xc-cookie-body" className="mt-1">
            We use essential cookies to run Xeccel. We only use optional analytics cookies if you accept them.{" "}
            <Link href="/legal/privacy" className="underline hover:text-[var(--heading)]">Read our Privacy Policy</Link>.
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={accept}
            className="min-h-11 min-w-32 rounded-full border border-[var(--border)] bg-[var(--accent)] px-5 text-sm font-bold text-[#0b132a]"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={reject}
            className="min-h-11 min-w-32 rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 text-sm font-bold text-[var(--heading)]"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

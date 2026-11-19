"use client";

import { COOKIE_SETTINGS_EVENT } from "./consentConfig";

/** Footer control that reopens the cookie banner from either Accept or Reject state. */
export default function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))}
      className="text-left hover:text-[var(--heading)]"
    >
      Cookie settings
    </button>
  );
}

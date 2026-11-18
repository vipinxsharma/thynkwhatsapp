// Partner signup journeys run by the Xeccel team from the platform admin page.
// A partner journey runs alongside direct tenant onboarding. Links are built here
// and never write to Meta or the database.

export interface PartnerJourney {
  code: string;
  name: string;
  pathway: string;
}

export const partnerJourneys: PartnerJourney[] = [
  { code: "direct-partner", name: "Partner-referred signup", pathway: "A partner shares a link; the workspace signs up on Xeccel." },
];

const CODE_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;

export function isValidPartnerCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

/** Builds the public signup link a partner shares. Returns null for an unsafe base URL or code. */
export function buildPartnerSignupLink(baseUrl: string, code: string): string | null {
  if (!isValidPartnerCode(code)) return null;
  let url: URL;
  try {
    url = new URL("/getting-started", baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  url.searchParams.set("partner", code);
  return url.toString();
}

/** Returns the partner code from a query or form value, or null when it is missing or unsafe. */
export function partnerCodeFrom(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim();
  return isValidPartnerCode(code) ? code : null;
}

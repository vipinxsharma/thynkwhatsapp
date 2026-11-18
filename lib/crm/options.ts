// The CRMs a workspace can pair with Xeccel. Shown on /crm and referenced by the plan copy.

export type CrmCode = "coldcall" | "supercrm";

export interface CrmOption {
  code: CrmCode;
  name: string;
  tagline: string;
  offer: string;
  included: string[];
  // Where the customer finishes sign-up. Undefined means access is arranged by the Xeccel team.
  signupUrl?: string;
  signupLabel: string;
}

function httpsUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

export const crmOptions: CrmOption[] = [
  {
    code: "coldcall",
    name: "Coldcall.in",
    tagline: "Calling and lead follow-up CRM for sales teams.",
    offer: "Free with your Xeccel plan",
    included: ["1 user", "1 web admin access"],
    signupUrl: httpsUrl(process.env.NEXT_PUBLIC_COLDCALL_SIGNUP_URL) ?? "https://coldcall.in",
    signupLabel: "Sign up for free",
  },
  {
    code: "supercrm",
    name: "SuperCRM",
    tagline: "A configurable sales execution platform for Indian B2B teams, from thynkWISE.",
    offer: "Free 21-day Full Access trial",
    included: ["No payment card required", "Access sent after a thynkWISE specialist reviews your application"],
    signupUrl: httpsUrl(process.env.NEXT_PUBLIC_SUPERCRM_SIGNUP_URL) ?? "https://thynkwise.co.in/supercrm#start-trial",
    signupLabel: "Apply for the free trial",
  },
];

export function isCrmCode(value: unknown): value is CrmCode {
  return typeof value === "string" && crmOptions.some((option) => option.code === value);
}

export function findCrmOption(code: unknown): CrmOption | undefined {
  return crmOptions.find((option) => option.code === code);
}

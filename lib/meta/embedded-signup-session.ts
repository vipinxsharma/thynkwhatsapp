export type SignupFinishType = "cloud_api" | "business_app";

export type SignupSessionEvent =
  | {
      kind: "finish";
      wabaId: string;
      phoneNumberId: string;
      finishType: SignupFinishType;
      businessId?: string;
    }
  | { kind: "cancel"; currentStep?: string }
  | { kind: "error"; errorMessage?: string; errorCode?: string; sessionId?: string }
  | { kind: "incomplete" };

// Meta can post from www, web, business or other facebook.com subdomains.
const META_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*facebook\.com$/;
const META_ID = /^\d+$/;

function text(value: unknown, max = 300): string | undefined {
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

export function parseSignupSessionEvent(origin: string, payload: unknown): SignupSessionEvent | null {
  if (!META_ORIGIN.test(origin)) return null;

  let message: unknown = payload;
  if (typeof payload === "string") {
    try {
      message = JSON.parse(payload);
    } catch {
      return null;
    }
  }

  if (!message || typeof message !== "object") return null;
  const event = message as { type?: unknown; event?: unknown; data?: unknown };
  if (event.type !== "WA_EMBEDDED_SIGNUP") return null;
  const data = event.data && typeof event.data === "object"
    ? (event.data as Record<string, unknown>)
    : null;

  if (event.event === "CANCEL") {
    const currentStep = text(data?.current_step, 80);
    return currentStep ? { kind: "cancel", currentStep } : { kind: "cancel" };
  }
  if (event.event === "ERROR") {
    const details = {
      errorMessage: text(data?.error_message),
      errorCode: text(data?.error_code, 40),
      sessionId: text(data?.session_id, 80),
    };
    return {
      kind: "error",
      ...Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined)),
    };
  }
  // FINISH, FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING and the retired v2 variants.
  if (typeof event.event !== "string" || !event.event.startsWith("FINISH")) return null;

  if (!data) return { kind: "incomplete" };
  const { waba_id, phone_number_id, business_id } = data;
  if (
    typeof waba_id !== "string" ||
    typeof phone_number_id !== "string" ||
    !META_ID.test(waba_id) ||
    !META_ID.test(phone_number_id)
  ) {
    return { kind: "incomplete" };
  }
  return {
    kind: "finish",
    wabaId: waba_id,
    phoneNumberId: phone_number_id,
    // A WhatsApp Business app (coexistence) number is already registered; Cloud API numbers are not.
    finishType: event.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" ? "business_app" : "cloud_api",
    ...(typeof business_id === "string" && META_ID.test(business_id) ? { businessId: business_id } : {}),
  };
}

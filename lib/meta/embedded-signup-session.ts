export type SignupSessionEvent =
  | { kind: "finish"; wabaId: string; phoneNumberId: string }
  | { kind: "cancel" }
  | { kind: "error" }
  | { kind: "incomplete" };

// Meta can post from www, web, business or other facebook.com subdomains.
const META_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*facebook\.com$/;

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
  if (event.event === "CANCEL") return { kind: "cancel" };
  if (event.event === "ERROR") return { kind: "error" };
  // FINISH, FINISH_ONLY_WABA, FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING, etc.
  if (typeof event.event !== "string" || !event.event.startsWith("FINISH")) return null;

  const data = event.data;
  if (!data || typeof data !== "object") return { kind: "incomplete" };
  const { waba_id, phone_number_id } = data as Record<string, unknown>;
  if (
    typeof waba_id !== "string" ||
    typeof phone_number_id !== "string" ||
    !/^\d+$/.test(waba_id) ||
    !/^\d+$/.test(phone_number_id)
  ) {
    return { kind: "incomplete" };
  }
  return { kind: "finish", wabaId: waba_id, phoneNumberId: phone_number_id };
}

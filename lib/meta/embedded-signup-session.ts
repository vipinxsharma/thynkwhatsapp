export type SignupSessionEvent =
  | { kind: "finish"; wabaId: string; phoneNumberId: string }
  | { kind: "cancel" }
  | { kind: "error" }
  | { kind: "incomplete" };

const META_ORIGINS = new Set(["https://www.facebook.com", "https://web.facebook.com"]);

export function parseSignupSessionEvent(origin: string, payload: unknown): SignupSessionEvent | null {
  if (!META_ORIGINS.has(origin)) return null;

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
  if (event.event !== "FINISH") return null;

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

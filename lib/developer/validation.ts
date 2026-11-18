// Pure request validation for the developer API. Each parser returns either a clean value or a
// message that is safe to show to the caller.

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** Digits only, 8 to 15 of them (E.164 without the plus sign). */
export function normalizeRecipientPhone(value: unknown): Parsed<string> {
  if (typeof value !== "string") return { ok: false, error: "phone number must be a string such as +919876543210" };
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    return { ok: false, error: "phone number must contain 8 to 15 digits in international format" };
  }
  return { ok: true, value: digits };
}

export interface SendRequestValue {
  to: string;
  type: "text" | "template";
  text: string;
  templateName: string;
  templateLanguage: string;
  templateVariables: string[];
}

export function parseSendRequest(body: Record<string, unknown>): Parsed<SendRequestValue> {
  const to = normalizeRecipientPhone(body.to);
  if (!to.ok) return { ok: false, error: `to: ${to.error}` };

  const type = body.type ?? "text";
  if (type !== "text" && type !== "template") return { ok: false, error: "type must be \"text\" or \"template\"" };

  if (type === "text") {
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return { ok: false, error: "text is required for a text message" };
    if (text.length > 4096) return { ok: false, error: "text must be 4096 characters or fewer" };
    return { ok: true, value: { to: to.value, type, text, templateName: "", templateLanguage: "en_US", templateVariables: [] } };
  }

  const template = body.template;
  if (!template || typeof template !== "object" || Array.isArray(template)) {
    return { ok: false, error: "template is required for a template message" };
  }
  const { name, language, variables } = template as Record<string, unknown>;
  if (typeof name !== "string" || !/^[a-z0-9_]{1,512}$/.test(name)) {
    return { ok: false, error: "template.name must be the approved template name (lowercase letters, digits and underscores)" };
  }
  const languageCode = language === undefined ? "en_US" : language;
  if (typeof languageCode !== "string" || !/^[A-Za-z]{2,3}(_[A-Za-z0-9]{2,4})?$/.test(languageCode)) {
    return { ok: false, error: "template.language must be a language code such as en_US" };
  }
  if (variables !== undefined && (!Array.isArray(variables) || variables.length > 20)) {
    return { ok: false, error: "template.variables must be an array of up to 20 values" };
  }
  const templateVariables = (variables as unknown[] | undefined)?.map((value) => String(value)) ?? [];
  if (templateVariables.some((value) => value.length > 1024)) {
    return { ok: false, error: "each template variable must be 1024 characters or fewer" };
  }
  return {
    ok: true,
    value: { to: to.value, type, text: "", templateName: name, templateLanguage: languageCode, templateVariables },
  };
}

export interface ContactInput {
  phoneNumber: string;
  name?: string;
  tags?: string[];
  customAttributes?: Record<string, unknown>;
}

export function parseContactInput(body: Record<string, unknown>): Parsed<ContactInput> {
  const phone = normalizeRecipientPhone(body.phoneNumber);
  if (!phone.ok) return { ok: false, error: `phoneNumber: ${phone.error}` };

  let name: string | undefined;
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length > 120) {
      return { ok: false, error: "name must be a string of 120 characters or fewer" };
    }
    name = body.name.trim();
  }

  let tags: string[] | undefined;
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags) || body.tags.length > 20 ||
        body.tags.some((tag) => typeof tag !== "string" || tag.length === 0 || tag.length > 40)) {
      return { ok: false, error: "tags must be up to 20 strings of 1 to 40 characters" };
    }
    tags = body.tags as string[];
  }

  let customAttributes: Record<string, unknown> | undefined;
  if (body.customAttributes !== undefined) {
    const value = body.customAttributes;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, error: "customAttributes must be an object" };
    }
    if (JSON.stringify(value).length > 4096) return { ok: false, error: "customAttributes must be 4 KB or smaller" };
    customAttributes = value as Record<string, unknown>;
  }

  return { ok: true, value: { phoneNumber: phone.value, name, tags, customAttributes } };
}

const CURSOR_PREFIX = "c1.";

export function encodeContactCursor(createdAt: string, id: string): string {
  return CURSOR_PREFIX + Buffer.from(JSON.stringify([createdAt, id]), "utf8").toString("base64url");
}

export function decodeContactCursor(value: string): Parsed<{ createdAt: string; id: string } | null> {
  if (!value) return { ok: true, value: null };
  if (!value.startsWith(CURSOR_PREFIX)) return { ok: false, error: "cursor is not valid" };
  try {
    const [createdAt, id] = JSON.parse(Buffer.from(value.slice(CURSOR_PREFIX.length), "base64url").toString("utf8")) as [unknown, unknown];
    if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt)) || typeof id !== "string" || !isUuid(id)) {
      return { ok: false, error: "cursor is not valid" };
    }
    return { ok: true, value: { createdAt, id } };
  } catch {
    return { ok: false, error: "cursor is not valid" };
  }
}

export function parseLimit(value: string | null, fallback = 50, max = 100): Parsed<number> {
  if (value === null || value === "") return { ok: true, value: fallback };
  if (!/^\d+$/.test(value)) return { ok: false, error: "limit must be a whole number" };
  const parsed = Number(value);
  if (parsed < 1 || parsed > max) return { ok: false, error: `limit must be between 1 and ${max}` };
  return { ok: true, value: parsed };
}

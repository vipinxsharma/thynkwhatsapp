// Pure validation for the contacts CRM: phone numbers, custom field definitions and typed values.
// No database access here so the rules can be unit-tested and shared by routes and the import modal.

export const FIELD_TYPES = ["text", "number", "date", "choice"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const CONSENT_STATUSES = ["subscribed", "unsubscribed"] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export type FieldDefinition = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  choices: string[];
};

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export const DURABLE_REQUIRED_MESSAGE =
  "Contact groups, custom fields and opt-out tracking need the durable inbox (INBOX_STORAGE=postgres).";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isConsentStatus(value: unknown): value is ConsentStatus {
  return typeof value === "string" && (CONSENT_STATUSES as readonly string[]).includes(value);
}

export function isFieldType(value: unknown): value is FieldType {
  return typeof value === "string" && (FIELD_TYPES as readonly string[]).includes(value);
}

/** Normalizes a phone number to digits. Returns E.164-style "+digits" or an error. */
export function normalizeContactPhone(raw: unknown, countryCode?: unknown): ValidationResult<{ phoneNumber: string; waId: string }> {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "Phone number is required" };
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  let international = digits;

  const ccDigits = typeof countryCode === "string" || typeof countryCode === "number"
    ? String(countryCode).replace(/\D/g, "")
    : "";

  if (!trimmed.startsWith("+") && ccDigits) {
    const alreadyInternational = digits.startsWith(ccDigits) && digits.length >= ccDigits.length + 8;
    if (!alreadyInternational) international = ccDigits + digits.replace(/^0+/, "");
  }

  if (international.length < 8 || international.length > 15) {
    return { ok: false, error: "Invalid phone number. Use full international format, e.g. +919876543210" };
  }
  return { ok: true, value: { phoneNumber: `+${international}`, waId: international } };
}

export function validateContactName(raw: unknown): ValidationResult<string> {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "Name is required" };
  const name = raw.trim();
  if (name.length > 120) return { ok: false, error: "Name must be 120 characters or fewer" };
  return { ok: true, value: name };
}

export function validateGroupName(raw: unknown): ValidationResult<string> {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "Group name is required" };
  const name = raw.trim();
  if (name.length > 80) return { ok: false, error: "Group name must be 80 characters or fewer" };
  return { ok: true, value: name };
}

/** Turns a label such as "Customer tier" into a stable attribute key such as "customer_tier". */
export function fieldKeyFromLabel(label: string): string {
  return label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[^a-z]+/, "")
    .slice(0, 40)
    .replace(/_+$/, "");
}

export function isValidFieldKey(key: string): boolean {
  return FIELD_KEY_PATTERN.test(key);
}

// Keys that already have a built-in meaning on every contact.
const RESERVED_FIELD_KEYS = new Set(["company"]);

export type FieldDefinitionInput = { label: unknown; type: unknown; choices?: unknown };

export function validateFieldDefinitionInput(input: FieldDefinitionInput): ValidationResult<{
  label: string;
  type: FieldType;
  choices: string[];
  key: string;
}> {
  if (typeof input.label !== "string" || !input.label.trim()) return { ok: false, error: "Field name is required" };
  const label = input.label.trim();
  if (label.length > 80) return { ok: false, error: "Field name must be 80 characters or fewer" };
  if (!isFieldType(input.type)) return { ok: false, error: "Field type must be text, number, date or choice" };

  const key = fieldKeyFromLabel(label);
  if (!isValidFieldKey(key)) return { ok: false, error: "Field name must contain at least one letter" };
  if (RESERVED_FIELD_KEYS.has(key)) return { ok: false, error: `"${label}" is reserved for the contact's built-in company field` };

  let choices: string[] = [];
  if (input.type === "choice") {
    const result = validateChoices(input.choices);
    if (!result.ok) return result;
    choices = result.value;
  }
  return { ok: true, value: { label, type: input.type, choices, key } };
}

export function validateChoices(raw: unknown): ValidationResult<string[]> {
  if (!Array.isArray(raw)) return { ok: false, error: "Choice fields need a list of options" };
  const seen = new Set<string>();
  const choices: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") return { ok: false, error: "Choice options must be text" };
    const choice = item.trim();
    if (!choice) continue;
    if (choice.length > 80) return { ok: false, error: "Each choice must be 80 characters or fewer" };
    if (seen.has(choice.toLowerCase())) continue;
    seen.add(choice.toLowerCase());
    choices.push(choice);
  }
  if (choices.length === 0) return { ok: false, error: "Add at least one choice option" };
  if (choices.length > 50) return { ok: false, error: "A choice field can have at most 50 options" };
  return { ok: true, value: choices };
}

/**
 * Validates one typed value. `null` means "clear this attribute" and is always accepted.
 */
export function normalizeCustomFieldValue(
  definition: Pick<FieldDefinition, "label" | "type" | "choices">,
  raw: unknown,
): ValidationResult<string | number | null> {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw === "boolean") return { ok: false, error: `${definition.label} must be text, a number, a date or a choice` };
  if (typeof raw === "string" && raw.trim() === "") return { ok: true, value: null };

  switch (definition.type) {
    case "text": {
      const text = String(raw).trim();
      if (text.length > 500) return { ok: false, error: `${definition.label} must be 500 characters or fewer` };
      return { ok: true, value: text };
    }
    case "number": {
      const text = String(raw).trim();
      if (!NUMBER_PATTERN.test(text)) return { ok: false, error: `${definition.label} must be a number` };
      const value = Number(text);
      if (!Number.isFinite(value)) return { ok: false, error: `${definition.label} must be a number` };
      return { ok: true, value };
    }
    case "date": {
      const text = String(raw).trim();
      if (!DATE_PATTERN.test(text)) return { ok: false, error: `${definition.label} must be a date as YYYY-MM-DD` };
      const [year, month, day] = text.split("-").map(Number);
      const check = new Date(Date.UTC(year, month - 1, day));
      if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
        return { ok: false, error: `${definition.label} must be a real calendar date` };
      }
      return { ok: true, value: text };
    }
    case "choice": {
      const text = String(raw).trim();
      const match = (definition.choices || []).find((choice) => choice.toLowerCase() === text.toLowerCase());
      if (!match) return { ok: false, error: `${definition.label} must be one of: ${(definition.choices || []).join(", ")}` };
      return { ok: true, value: match };
    }
  }
}

/**
 * Validates a custom attributes object against the workspace's field definitions.
 * Keys without a definition are kept as free-form text or numbers, as before.
 */
export function validateCustomAttributes(
  definitions: FieldDefinition[],
  attributes: unknown,
): ValidationResult<Record<string, string | number | null>> {
  if (attributes === undefined || attributes === null) return { ok: true, value: {} };
  if (typeof attributes !== "object" || Array.isArray(attributes)) {
    return { ok: false, error: "Custom attributes must be an object" };
  }

  const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const output: Record<string, string | number | null> = {};
  const errors: string[] = [];

  for (const [key, raw] of Object.entries(attributes as Record<string, unknown>)) {
    if (key.length > 64) {
      errors.push("Attribute names must be 64 characters or fewer");
      continue;
    }
    const definition = byKey.get(key);
    if (definition) {
      const result = normalizeCustomFieldValue(definition, raw);
      if (result.ok) output[key] = result.value;
      else errors.push(result.error);
      continue;
    }
    if (raw === null || raw === undefined) {
      output[key] = null;
    } else if (typeof raw === "string") {
      output[key] = raw.trim().slice(0, 500);
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      output[key] = raw;
    } else {
      errors.push(`${key} must be text or a number`);
    }
  }

  if (errors.length) return { ok: false, error: errors[0] };
  return { ok: true, value: output };
}

export function validateUuidList(raw: unknown, max: number, label: string): ValidationResult<string[]> {
  if (!Array.isArray(raw)) return { ok: false, error: `${label} must be a list` };
  const unique = Array.from(new Set(raw));
  if (unique.length > max) return { ok: false, error: `${label} can include at most ${max} items` };
  if (!unique.every(isUuid)) return { ok: false, error: `${label} must contain valid IDs` };
  return { ok: true, value: unique as string[] };
}

export function parseIntParam(raw: string | null, fallback: number, max: number): number | null {
  if (raw === null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return null;
  return Math.min(value, max);
}

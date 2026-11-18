import { describe, expect, it } from "vitest";
import {
  fieldKeyFromLabel,
  normalizeContactPhone,
  normalizeCustomFieldValue,
  parseIntParam,
  validateCustomAttributes,
  validateFieldDefinitionInput,
  validateUuidList,
  type FieldDefinition,
} from "../lib/contacts/validation";

const tier: FieldDefinition = { id: "1", key: "customer_tier", label: "Customer tier", type: "choice", choices: ["Gold", "Silver"] };
const plan: FieldDefinition = { id: "2", key: "plan_renewal", label: "Plan renewal", type: "date", choices: [] };
const seats: FieldDefinition = { id: "3", key: "seats", label: "Seats", type: "number", choices: [] };

describe("custom field keys and definitions", () => {
  it("derives stable keys from labels", () => {
    expect(fieldKeyFromLabel("Customer tier!")).toBe("customer_tier");
    expect(fieldKeyFromLabel("  Café  Tier ")).toBe("cafe_tier");
    expect(fieldKeyFromLabel("123 plan")).toBe("plan");
    expect(fieldKeyFromLabel("!!!")).toBe("");
  });

  it("requires choice options and removes duplicates case-insensitively", () => {
    expect(validateFieldDefinitionInput({ label: "Tier", type: "choice", choices: [] }).ok).toBe(false);
    const result = validateFieldDefinitionInput({ label: "Tier", type: "choice", choices: ["Gold", " gold ", "Silver", ""] });
    expect(result).toEqual({ ok: true, value: { label: "Tier", type: "choice", choices: ["Gold", "Silver"], key: "tier" } });
  });

  it("reserves the built-in company attribute", () => {
    expect(validateFieldDefinitionInput({ label: "Company", type: "text" }).ok).toBe(false);
    expect(validateFieldDefinitionInput({ label: "Company name", type: "text" }).ok).toBe(true);
  });

  it("rejects unknown types and labels without letters", () => {
    expect(validateFieldDefinitionInput({ label: "Tier", type: "email" }).ok).toBe(false);
    expect(validateFieldDefinitionInput({ label: "123", type: "text" }).ok).toBe(false);
  });

  it("ignores choices for non-choice fields", () => {
    expect(validateFieldDefinitionInput({ label: "Notes", type: "text", choices: ["x"] })).toEqual({
      ok: true,
      value: { label: "Notes", type: "text", choices: [], key: "notes" },
    });
  });
});

describe("typed values", () => {
  it("treats empty input as a clear", () => {
    expect(normalizeCustomFieldValue(seats, "  ")).toEqual({ ok: true, value: null });
    expect(normalizeCustomFieldValue(seats, null)).toEqual({ ok: true, value: null });
  });

  it("parses numbers and rejects text", () => {
    expect(normalizeCustomFieldValue(seats, "12.5")).toEqual({ ok: true, value: 12.5 });
    expect(normalizeCustomFieldValue(seats, "12abc").ok).toBe(false);
    expect(normalizeCustomFieldValue(seats, "1e3").ok).toBe(false);
  });

  it("accepts only real calendar dates", () => {
    expect(normalizeCustomFieldValue(plan, "2026-02-28")).toEqual({ ok: true, value: "2026-02-28" });
    expect(normalizeCustomFieldValue(plan, "2026-02-30").ok).toBe(false);
    expect(normalizeCustomFieldValue(plan, "28/02/2026").ok).toBe(false);
  });

  it("matches choices case-insensitively and returns the canonical option", () => {
    expect(normalizeCustomFieldValue(tier, "gold")).toEqual({ ok: true, value: "Gold" });
    expect(normalizeCustomFieldValue(tier, "Bronze").ok).toBe(false);
  });

  it("validates a whole attributes object and keeps unknown keys", () => {
    expect(
      validateCustomAttributes([tier, seats], { customer_tier: "Silver", seats: "4", company: " Acme ", note: null }),
    ).toEqual({ ok: true, value: { customer_tier: "Silver", seats: 4, company: "Acme", note: null } });

    const bad = validateCustomAttributes([tier], { customer_tier: "Platinum" });
    expect(bad.ok).toBe(false);
    expect(validateCustomAttributes([], { flags: true }).ok).toBe(false);
    expect(validateCustomAttributes([], ["not", "an", "object"]).ok).toBe(false);
  });
});

describe("phone numbers", () => {
  it("normalizes international numbers to digits", () => {
    expect(normalizeContactPhone("+91 98111 22233")).toEqual({ ok: true, value: { phoneNumber: "+919811122233", waId: "919811122233" } });
  });

  it("joins a separate country code and strips a trunk zero", () => {
    expect(normalizeContactPhone("9811122233", "+91")).toMatchObject({ ok: true, value: { waId: "919811122233" } });
    expect(normalizeContactPhone("07911123456", "44")).toMatchObject({ ok: true, value: { waId: "447911123456" } });
  });

  it("does not double a country code already present", () => {
    expect(normalizeContactPhone("919811122233", "91")).toMatchObject({ ok: true, value: { waId: "919811122233" } });
  });

  it("rejects numbers that are too short or too long", () => {
    expect(normalizeContactPhone("12345").ok).toBe(false);
    expect(normalizeContactPhone("1234567890123456").ok).toBe(false);
    expect(normalizeContactPhone("").ok).toBe(false);
  });
});

describe("request helpers", () => {
  it("validates ID lists", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(validateUuidList([id, id], 5, "ids")).toEqual({ ok: true, value: [id] });
    expect(validateUuidList(["nope"], 5, "ids").ok).toBe(false);
    expect(validateUuidList("x", 5, "ids").ok).toBe(false);
    expect(validateUuidList([id, "11111111-1111-4111-8111-111111111112"], 1, "ids").ok).toBe(false);
  });

  it("parses bounded positive integers", () => {
    expect(parseIntParam(null, 25, 100)).toBe(25);
    expect(parseIntParam("500", 25, 100)).toBe(100);
    expect(parseIntParam("0", 25, 100)).toBeNull();
    expect(parseIntParam("abc", 25, 100)).toBeNull();
  });
});

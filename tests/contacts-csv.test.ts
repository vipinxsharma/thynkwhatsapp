import { describe, expect, it } from "vitest";
import {
  SAMPLE_CONTACTS_CSV,
  buildImportPlan,
  guessColumnMapping,
  parseCsv,
  validateColumnMapping,
  type ColumnMapping,
} from "../lib/contacts/csv";

describe("parseCsv", () => {
  it("handles quotes, embedded commas, CRLF, BOM and blank lines", () => {
    const text = '﻿Name,Company\r\n"Doe, Jane","Acme ""Labs"""\r\n\r\nSam,\n';
    expect(parseCsv(text)).toEqual({
      headers: ["Name", "Company"],
      rows: [["Doe, Jane", 'Acme "Labs"'], ["Sam", ""]],
    });
  });

  it("returns nothing for an empty file", () => {
    expect(parseCsv("\n\n")).toEqual({ headers: [], rows: [] });
  });
});

describe("guessColumnMapping", () => {
  it("suggests targets from headers and uses matching custom fields", () => {
    const headers = ["Name", "Phone Number", "Country Code", "Company", "Tags", "Group", "Customer Tier", "Notes"];
    const mapping = guessColumnMapping(headers, [{ key: "customer_tier", label: "Customer Tier" }]);
    expect(mapping).toEqual([
      { kind: "name" },
      { kind: "phone" },
      { kind: "country_code" },
      { kind: "attribute", key: "company" },
      { kind: "tags" },
      { kind: "group" },
      { kind: "attribute", key: "customer_tier" },
      { kind: "attribute", key: "notes" },
    ]);
    expect(validateColumnMapping(mapping)).toEqual({ ok: true, value: true });
  });

  it("does not treat a company name column as the contact name", () => {
    const mapping = guessColumnMapping(["Company name", "Mobile"]);
    expect(mapping[0]).toEqual({ kind: "attribute", key: "company_name" });
    expect(mapping[1]).toEqual({ kind: "phone" });
  });
});

describe("validateColumnMapping", () => {
  it("requires exactly one phone and one name column", () => {
    expect(validateColumnMapping([{ kind: "name" }]).ok).toBe(false);
    expect(validateColumnMapping([{ kind: "name" }, { kind: "phone" }, { kind: "phone" }]).ok).toBe(false);
    expect(validateColumnMapping([{ kind: "name" }, { kind: "phone" }, { kind: "group" }, { kind: "group" }]).ok).toBe(false);
  });

  it("rejects duplicate attribute keys", () => {
    const mapping: ColumnMapping = [
      { kind: "name" },
      { kind: "phone" },
      { kind: "attribute", key: "city" },
      { kind: "attribute", key: "city" },
    ];
    expect(validateColumnMapping(mapping).ok).toBe(false);
  });
});

describe("buildImportPlan", () => {
  const mapping: ColumnMapping = [
    { kind: "name" },
    { kind: "phone" },
    { kind: "country_code" },
    { kind: "attribute", key: "customer_tier" },
    { kind: "group" },
    { kind: "tags" },
    { kind: "ignore" },
  ];

  it("builds rows with normalized phones, attributes, groups and default tags", () => {
    const plan = buildImportPlan(mapping, [
      ["Asha", "9811122233", "+91", "Gold", "Diwali list", "", "x"],
      ["Ben", "+14155550100", "", "", "", "VIP;Lead", "x"],
    ]);
    expect(plan.errors).toEqual([]);
    expect(plan.rows[0]).toMatchObject({
      line: 2,
      name: "Asha",
      phoneNumber: "+919811122233",
      customAttributes: { customer_tier: "Gold" },
      groupName: "Diwali list",
      tags: ["Imported CSV"],
    });
    expect(plan.rows[1]).toMatchObject({ line: 3, phoneNumber: "+14155550100", tags: ["VIP", "Lead"] });
    expect(plan.rows[1].groupName).toBeUndefined();
    expect(plan.rows[1].customAttributes).toEqual({});
  });

  it("reports bad rows with their line numbers instead of dropping them silently", () => {
    const plan = buildImportPlan(mapping, [
      ["", "9811122233", "+91", "", "", "", ""],
      ["Carl", "12", "", "", "", "", ""],
      ["Dana", "9811122234", "+91", "", "", "", ""],
    ]);
    expect(plan.rows.map((row) => row.name)).toEqual(["Dana"]);
    expect(plan.errors.map((error) => error.line)).toEqual([2, 3]);
  });

  it("parses the bundled sample file completely", () => {
    const parsed = parseCsv(SAMPLE_CONTACTS_CSV);
    const mappingForSample = guessColumnMapping(parsed.headers, [{ key: "customer_tier", label: "customer tier" }]);
    expect(validateColumnMapping(mappingForSample).ok).toBe(true);
    const plan = buildImportPlan(mappingForSample, parsed.rows);
    expect(plan.errors).toEqual([]);
    expect(plan.rows).toHaveLength(3);
    expect(plan.rows.map((row) => row.phoneNumber)).toEqual(["+919811122233", "+14155551212", "+919922233344"]);
  });
});

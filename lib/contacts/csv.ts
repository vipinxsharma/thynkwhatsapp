// CSV parsing and column mapping for contact import. Pure functions, shared by the import modal and tests.
import {
  fieldKeyFromLabel,
  isValidFieldKey,
  normalizeContactPhone,
  validateContactName,
  type ValidationResult,
} from "./validation";

export type ColumnTarget =
  | { kind: "ignore" }
  | { kind: "name" }
  | { kind: "phone" }
  | { kind: "country_code" }
  | { kind: "group" }
  | { kind: "tags" }
  | { kind: "attribute"; key: string };

export type ColumnMapping = ColumnTarget[];

export type ParsedCsv = { headers: string[]; rows: string[][] };

export type ImportRow = {
  line: number;
  name: string;
  phoneNumber: string;
  tags: string[];
  customAttributes: Record<string, string>;
  groupName?: string;
};

export type ImportPlan = {
  rows: ImportRow[];
  errors: Array<{ line: number; message: string }>;
};

/** RFC 4180-style parser: quoted cells, doubled quotes, CRLF or LF. Blank lines are dropped. */
export function parseCsv(text: string): ParsedCsv {
  const source = text.replace(/^﻿/, "");
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      record.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      record.push(cell);
      records.push(record);
      record = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell.length || record.length) {
    record.push(cell);
    records.push(record);
  }

  const nonBlank = records.filter((row) => row.some((value) => value.trim() !== ""));
  if (nonBlank.length === 0) return { headers: [], rows: [] };
  const [headerRow, ...rows] = nonBlank;
  return {
    headers: headerRow.map((header) => header.trim()),
    rows: rows.map((row) => row.map((value) => value.trim())),
  };
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Suggests a mapping from header names. The user can change every choice in the modal. */
export function guessColumnMapping(
  headers: string[],
  definitions: Array<{ key: string; label: string }> = [],
): ColumnMapping {
  const taken = new Set<string>();
  const claim = (kind: "name" | "phone" | "country_code" | "group" | "tags", index: number): ColumnTarget => {
    if (taken.has(kind)) return attributeTarget(headers[index], index, definitions);
    taken.add(kind);
    return { kind };
  };

  return headers.map((header, index) => {
    const normalized = normalizeHeader(header);
    if (!normalized) return { kind: "ignore" };
    if (/\b(country|dial|isd)\b|^cc$/.test(normalized)) return claim("country_code", index);
    if (/\b(group|list|segment|audience)\b/.test(normalized)) return claim("group", index);
    if (/\b(tags?|labels?)\b/.test(normalized)) return claim("tags", index);
    if (/\b(company|organi[sz]ation|org|business)\b/.test(normalized)) {
      // A plain "Company" header maps to the company attribute; "Company name" keeps its own key.
      const plain = /^(company|organi[sz]ation|org|business)$/.test(normalized);
      return attributeTarget(header, index, definitions, plain ? "company" : undefined);
    }
    if (/\b(phone|mobile|whatsapp|wa|msisdn|wa id|number)\b/.test(normalized)) return claim("phone", index);
    if (/^(full )?name$|\bcontact name\b|\bcustomer name\b/.test(normalized)) return claim("name", index);
    return attributeTarget(header, index, definitions);
  });
}

function attributeTarget(
  header: string,
  index: number,
  definitions: Array<{ key: string; label: string }>,
  forcedKey?: string,
): ColumnTarget {
  if (forcedKey) return { kind: "attribute", key: forcedKey };
  const lower = header.trim().toLowerCase();
  const match = definitions.find((definition) => definition.label.trim().toLowerCase() === lower || definition.key === fieldKeyFromLabel(header));
  if (match) return { kind: "attribute", key: match.key };
  const key = fieldKeyFromLabel(header) || `column_${index + 1}`;
  return { kind: "attribute", key: isValidFieldKey(key) ? key : `column_${index + 1}` };
}

/** Checks that the mapping can be imported: one phone and one name column, unique attribute keys. */
export function validateColumnMapping(mapping: ColumnMapping): ValidationResult<true> {
  const count = (kind: ColumnTarget["kind"]) => mapping.filter((target) => target.kind === kind).length;
  if (count("phone") !== 1) return { ok: false, error: "Choose exactly one column for the phone number" };
  if (count("name") !== 1) return { ok: false, error: "Choose exactly one column for the name" };
  for (const kind of ["country_code", "group", "tags"] as const) {
    if (count(kind) > 1) return { ok: false, error: "Each column can be mapped to a field only once" };
  }
  const keys = new Set<string>();
  for (const target of mapping) {
    if (target.kind !== "attribute") continue;
    if (!isValidFieldKey(target.key)) return { ok: false, error: `Attribute key "${target.key}" is not valid` };
    if (keys.has(target.key)) return { ok: false, error: `Two columns are mapped to "${target.key}"` };
    keys.add(target.key);
  }
  return { ok: true, value: true };
}

/** Applies a mapping to parsed rows. Invalid rows are reported with their line numbers, not dropped silently. */
export function buildImportPlan(mapping: ColumnMapping, rows: string[][]): ImportPlan {
  const indexOf = (kind: ColumnTarget["kind"]) => mapping.findIndex((target) => target.kind === kind);
  const phoneIndex = indexOf("phone");
  const nameIndex = indexOf("name");
  const countryIndex = indexOf("country_code");
  const groupIndex = indexOf("group");
  const tagsIndex = indexOf("tags");
  const output: ImportRow[] = [];
  const errors: ImportPlan["errors"] = [];

  rows.forEach((cells, offset) => {
    const line = offset + 2;
    const cell = (index: number) => (index >= 0 ? (cells[index] || "").trim() : "");

    const phone = normalizeContactPhone(cell(phoneIndex), cell(countryIndex) || undefined);
    if (!phone.ok) {
      errors.push({ line, message: phone.error });
      return;
    }
    const name = validateContactName(cell(nameIndex));
    if (!name.ok) {
      errors.push({ line, message: name.error });
      return;
    }

    const customAttributes: Record<string, string> = {};
    mapping.forEach((target, index) => {
      if (target.kind !== "attribute") return;
      const value = cell(index);
      if (value) customAttributes[target.key] = value;
    });

    const rawTags = cell(tagsIndex);
    const tags = rawTags
      ? rawTags.split(";").map((tag) => tag.trim()).filter(Boolean)
      : ["Imported CSV"];

    output.push({
      line,
      name: name.value,
      phoneNumber: phone.value.phoneNumber,
      tags,
      customAttributes,
      ...(groupIndex >= 0 && cell(groupIndex) ? { groupName: cell(groupIndex) } : {}),
    });
  });

  return { rows: output, errors };
}

export const SAMPLE_CONTACTS_CSV = `name,phone,country code,company,tags,group,customer tier
Rajesh Kumar,9811122233,+91,Tata Motors,Enterprise;Automotive,Q4 leads,Gold
Elena Rostova,4155551212,+1,Apex Global,Fintech;Growth,Q4 leads,Silver
Ananya Sen,+919922233344,,CloudScale,VIP Customer,Newsletter,Bronze`;

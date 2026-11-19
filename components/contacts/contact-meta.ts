"use client";

import { useCallback, useEffect, useState } from "react";

export type ContactGroupOption = { id: string; name: string; memberCount: number };

export type CustomFieldOption = {
  id: string;
  key: string;
  label: string;
  type: "text" | "number" | "date" | "choice";
  choices: string[];
};

/** Loads contact groups and custom field definitions for the contact forms and list filters. */
export function useContactMeta(enabled: boolean) {
  const [groups, setGroups] = useState<ContactGroupOption[]>([]);
  const [fields, setFields] = useState<CustomFieldOption[]>([]);
  const [metaError, setMetaError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [groupRes, fieldRes] = await Promise.all([
        fetch("/api/contacts/groups"),
        fetch("/api/contacts/fields"),
      ]);
      const groupJson = await groupRes.json();
      const fieldJson = await fieldRes.json();
      if (!groupRes.ok) throw new Error(groupJson.error || "Failed to load groups");
      if (!fieldRes.ok) throw new Error(fieldJson.error || "Failed to load custom fields");
      setGroups(groupJson.data || []);
      setFields(fieldJson.data || []);
      setMetaError("");
    } catch (err: any) {
      setMetaError(err.message || "Failed to load contact settings");
    }
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { groups, fields, metaError, refresh };
}

/** Converts stored custom attribute values to strings for form inputs. */
export function attributesToFormValues(
  fields: CustomFieldOption[],
  attributes: Record<string, unknown> | undefined,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    const raw = attributes?.[field.key];
    values[field.key] = raw === null || raw === undefined ? "" : String(raw);
  }
  return values;
}

/** Builds the attributes payload. Cleared fields are sent as null so the stored value is removed. */
export function formValuesToAttributes(
  fields: CustomFieldOption[],
  values: Record<string, string>,
): Record<string, string | null> {
  const payload: Record<string, string | null> = {};
  for (const field of fields) {
    const value = (values[field.key] ?? "").trim();
    payload[field.key] = value === "" ? null : value;
  }
  return payload;
}

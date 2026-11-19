"use client";

import type { ContactGroupOption, CustomFieldOption } from "./contact-meta";

const inputClass =
  "w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light transition-all text-xs";

/** One typed input per custom field definition: text, number, date or a choice list. */
export function CustomFieldInputs({
  fields,
  values,
  onChange,
}: {
  fields: CustomFieldOption[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const id = `custom-field-${field.key}`;
        const value = values[field.key] ?? "";
        return (
          <div key={field.key}>
            <label htmlFor={id} className="block text-gray-300 font-semibold mb-1">
              {field.label}
            </label>
            {field.type === "choice" ? (
              <select id={id} value={value} onChange={(e) => onChange(field.key, e.target.value)} className={inputClass}>
                <option value="">Not set</option>
                {field.choices.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                step={field.type === "number" ? "any" : undefined}
                value={value}
                onChange={(e) => onChange(field.key, e.target.value)}
                className={inputClass}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Checkbox list of groups. Hidden when no groups exist yet. */
export function GroupCheckboxes({
  groups,
  selected,
  onToggle,
}: {
  groups: ContactGroupOption[];
  selected: string[];
  onToggle: (groupId: string) => void;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-[11px] text-gray-500">
        No groups yet. Create groups under Contacts &rsaquo; Groups &amp; fields.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {groups.map((group) => {
        const checked = selected.includes(group.id);
        return (
          <label
            key={group.id}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all ${
              checked
                ? "bg-whatsapp/20 border-whatsapp/30 text-whatsapp-light"
                : "bg-black/30 border-white/10 text-gray-400 hover:text-white"
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(group.id)}
              className="accent-emerald-500"
            />
            <span className="font-medium">{group.name}</span>
          </label>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import type { ContactGroupOption, CustomFieldOption } from "@/components/contacts/contact-meta";

const inputClass =
  "px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light transition-all text-xs";
const buttonClass =
  "flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 font-semibold text-xs transition-all disabled:opacity-50";

const FIELD_TYPE_LABELS: Record<CustomFieldOption["type"], string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  choice: "Choice",
};

function parseChoices(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((choice) => choice.trim())
    .filter(Boolean);
}

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

export default function ContactSettingsPage() {
  const [groups, setGroups] = useState<ContactGroupOption[]>([]);
  const [fields, setFields] = useState<CustomFieldOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");

  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<CustomFieldOption["type"]>("text");
  const [newFieldChoices, setNewFieldChoices] = useState("");
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingFieldLabel, setEditingFieldLabel] = useState("");
  const [editingFieldChoices, setEditingFieldChoices] = useState("");

  const load = async () => {
    try {
      const [groupJson, fieldJson] = await Promise.all([
        call("/api/contacts/groups", "GET"),
        call("/api/contacts/fields", "GET"),
      ]);
      setGroups(groupJson.data || []);
      setFields(fieldJson.data || []);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const run = async (task: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      setNotice(message);
      await load();
      return true;
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createGroup = async () => {
    const ok = await run(() => call("/api/contacts/groups", "POST", { name: newGroupName }), "Group created");
    if (ok) setNewGroupName("");
  };

  const saveGroup = async (id: string) => {
    const ok = await run(() => call("/api/contacts/groups", "PATCH", { id, name: editingGroupName }), "Group renamed");
    if (ok) setEditingGroupId(null);
  };

  const deleteGroup = async (group: ContactGroupOption) => {
    if (!confirm(`Delete the group "${group.name}"? Contacts stay in your CRM; only the group is removed.`)) return;
    await run(() => call(`/api/contacts/groups?id=${group.id}`, "DELETE"), "Group deleted");
  };

  const createField = async () => {
    const ok = await run(
      () =>
        call("/api/contacts/fields", "POST", {
          label: newFieldLabel,
          type: newFieldType,
          choices: newFieldType === "choice" ? parseChoices(newFieldChoices) : undefined,
        }),
      "Custom field added",
    );
    if (ok) {
      setNewFieldLabel("");
      setNewFieldChoices("");
      setNewFieldType("text");
    }
  };

  const saveField = async (field: CustomFieldOption) => {
    const ok = await run(
      () =>
        call("/api/contacts/fields", "PATCH", {
          id: field.id,
          label: editingFieldLabel,
          ...(field.type === "choice" ? { choices: parseChoices(editingFieldChoices) } : {}),
        }),
      "Custom field saved",
    );
    if (ok) setEditingFieldId(null);
  };

  const deleteField = async (field: CustomFieldOption) => {
    if (!confirm(`Delete the field "${field.label}"? Values already stored on contacts are kept but no longer shown as a typed field.`)) return;
    await run(() => call(`/api/contacts/fields?id=${field.id}`, "DELETE"), "Custom field deleted");
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-4xl">
      <div className="pb-6 border-b border-white/5">
        <Link href="/contacts" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white mb-3">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to contacts
        </Link>
        <h1 className="text-2xl font-bold text-white tracking-tight">Groups &amp; custom fields</h1>
        <p className="text-sm text-gray-400 mt-1">
          Organise contacts into groups for lists and imports, and define typed fields for extra contact details.
        </p>
      </div>

      {(error || notice) && (
        <div
          className={`p-3 rounded-lg text-xs border ${
            error ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          {error || notice}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* Groups */}
          <section className="rounded-2xl bg-surface-100/60 border border-white/5 p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">Groups</h2>
              <p className="text-xs text-gray-400 mt-1">
                A contact can belong to many groups. Filter the contact list by group, add selected contacts to one, or
                import into one.
              </p>
            </div>

            <div className="flex gap-2">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="New group name, e.g. Diwali offer list"
                maxLength={80}
                aria-label="New group name"
                className={`${inputClass} flex-1`}
              />
              <button
                onClick={createGroup}
                disabled={busy || !newGroupName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-whatsapp-light text-black font-bold text-xs disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" /> Add group
              </button>
            </div>

            {groups.length === 0 ? (
              <p className="text-xs text-gray-500">No groups yet.</p>
            ) : (
              <ul className="divide-y divide-white/5 rounded-lg border border-white/5">
                {groups.map((group) => (
                  <li key={group.id} className="flex items-center justify-between gap-3 p-3 text-xs">
                    {editingGroupId === group.id ? (
                      <div className="flex flex-1 gap-2">
                        <input
                          value={editingGroupName}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          maxLength={80}
                          aria-label={`Rename ${group.name}`}
                          className={`${inputClass} flex-1`}
                        />
                        <button onClick={() => saveGroup(group.id)} disabled={busy} className={buttonClass}>
                          <Check className="w-3.5 h-3.5" /> Save
                        </button>
                        <button onClick={() => setEditingGroupId(null)} className={buttonClass}>
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="font-semibold text-white">{group.name}</p>
                          <p className="text-gray-500">{group.memberCount} contacts</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingGroupId(group.id);
                              setEditingGroupName(group.name);
                            }}
                            className={buttonClass}
                          >
                            <Pencil className="w-3.5 h-3.5" /> Rename
                          </button>
                          <button
                            onClick={() => deleteGroup(group)}
                            disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-semibold text-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Custom fields */}
          <section className="rounded-2xl bg-surface-100/60 border border-white/5 p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">Custom fields</h2>
              <p className="text-xs text-gray-400 mt-1">
                Typed fields appear on the contact form and in CSV import. The field type cannot change after creation.
              </p>
            </div>

            <div className="grid gap-2 md:grid-cols-[1fr_9rem]">
              <input
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder="Field name, e.g. Customer tier"
                maxLength={80}
                aria-label="New field name"
                className={inputClass}
              />
              <select
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value as CustomFieldOption["type"])}
                aria-label="Field type"
                className={inputClass}
              >
                {(Object.keys(FIELD_TYPE_LABELS) as CustomFieldOption["type"][]).map((type) => (
                  <option key={type} value={type}>
                    {FIELD_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            {newFieldType === "choice" && (
              <textarea
                value={newFieldChoices}
                onChange={(e) => setNewFieldChoices(e.target.value)}
                rows={2}
                placeholder="Options separated by commas, e.g. Gold, Silver, Bronze"
                aria-label="Choice options"
                className={`${inputClass} w-full`}
              />
            )}
            <div>
              <button
                onClick={createField}
                disabled={busy || !newFieldLabel.trim() || (newFieldType === "choice" && parseChoices(newFieldChoices).length === 0)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-whatsapp-light text-black font-bold text-xs disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" /> Add field
              </button>
            </div>

            {fields.length === 0 ? (
              <p className="text-xs text-gray-500">No custom fields yet.</p>
            ) : (
              <ul className="divide-y divide-white/5 rounded-lg border border-white/5">
                {fields.map((field) => (
                  <li key={field.id} className="p-3 text-xs space-y-2">
                    {editingFieldId === field.id ? (
                      <div className="space-y-2">
                        <input
                          value={editingFieldLabel}
                          onChange={(e) => setEditingFieldLabel(e.target.value)}
                          maxLength={80}
                          aria-label={`Rename ${field.label}`}
                          className={`${inputClass} w-full`}
                        />
                        {field.type === "choice" && (
                          <textarea
                            value={editingFieldChoices}
                            onChange={(e) => setEditingFieldChoices(e.target.value)}
                            rows={2}
                            aria-label={`Options for ${field.label}`}
                            className={`${inputClass} w-full`}
                          />
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => saveField(field)} disabled={busy} className={buttonClass}>
                            <Check className="w-3.5 h-3.5" /> Save
                          </button>
                          <button onClick={() => setEditingFieldId(null)} className={buttonClass}>
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-white">
                            {field.label}{" "}
                            <span className="ml-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-gray-300">
                              {FIELD_TYPE_LABELS[field.type]}
                            </span>
                          </p>
                          <p className="font-mono text-gray-500">key: {field.key}</p>
                          {field.type === "choice" && (
                            <p className="text-gray-400">Options: {field.choices.join(", ")}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingFieldId(field.id);
                              setEditingFieldLabel(field.label);
                              setEditingFieldChoices(field.choices.join(", "));
                            }}
                            className={buttonClass}
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => deleteField(field)}
                            disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-semibold text-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

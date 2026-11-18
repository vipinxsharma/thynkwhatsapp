"use client";

import { useState, useEffect } from "react";
import { X, Edit3, Phone, Building, Tag, Loader2, Sparkles, Trash2, Users } from "lucide-react";
import { CustomFieldInputs, GroupCheckboxes } from "./CustomFieldInputs";
import {
  attributesToFormValues,
  formValuesToAttributes,
  useContactMeta,
} from "./contact-meta";

interface EditContactModalProps {
  isOpen: boolean;
  contact: any | null;
  onClose: () => void;
  onContactUpdated: (updatedContact: any) => void;
  onContactDeleted: (contactId: string | number) => void;
}

export function EditContactModal({
  isOpen,
  contact,
  onClose,
  onContactUpdated,
  onContactDeleted,
}: EditContactModalProps) {
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [company, setCompany] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const { groups, fields, metaError } = useContactMeta(isOpen);

  useEffect(() => {
    if (contact) {
      setName(contact.name || "");
      setPhoneNumber(contact.phoneNumber || "");
      setCompany(contact.customAttributes?.company || "");
      setTagsInput((contact.tags || []).join(", "));
      setGroupIds(contact.groupIds || []);
    }
  }, [contact]);

  useEffect(() => {
    if (contact) setFieldValues(attributesToFormValues(fields, contact.customAttributes));
  }, [contact, fields]);

  if (!isOpen || !contact) return null;

  const toggleGroup = (groupId: string) => {
    setGroupIds((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    setLoading(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const res = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: contact.id,
          name: name.trim(),
          phoneNumber: phoneNumber.trim(),
          company: company.trim(),
          tags,
          groupIds,
          customAttributes: formValuesToAttributes(fields, fieldValues),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update contact");
      }

      onContactUpdated(json.data);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${contact.name}?`)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/contacts?id=${contact.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete contact");
      }

      onContactDeleted(contact.id);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-surface-100/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Edit Contact</h2>
              <p className="text-xs text-gray-400">Update CRM profile & WhatsApp details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto">
          {(error || metaError) && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              {error || metaError}
            </div>
          )}

          <div>
            <label className="block text-gray-300 font-semibold mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light transition-all text-xs"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1">
              WhatsApp Phone Number *
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white font-mono placeholder-gray-500 focus:outline-none focus:border-whatsapp-light transition-all text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1">Company / Organization</label>
            <div className="relative">
              <Building className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light transition-all text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1">
              CRM Tags (comma separated)
            </label>
            <div className="relative">
              <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light transition-all text-xs"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-gray-300 font-semibold mb-1">
              <Users className="w-3.5 h-3.5 text-gray-400" />
              Groups
            </label>
            <GroupCheckboxes groups={groups} selected={groupIds} onToggle={toggleGroup} />
          </div>

          {fields.length > 0 && (
            <div className="pt-1 border-t border-white/5">
              <p className="text-gray-300 font-semibold mb-3">Custom fields</p>
              <CustomFieldInputs
                fields={fields}
                values={fieldValues}
                onChange={(key, value) => setFieldValues((current) => ({ ...current, [key]: value }))}
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-semibold transition-all text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{deleting ? "Deleting..." : "Delete Contact"}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-whatsapp-light hover:brightness-110 active:scale-95 text-black font-bold transition-all shadow-glow disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

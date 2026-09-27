"use client";

import { useState } from "react";
import { X, UserPlus, Phone, Building, Tag, FileText, Loader2, Sparkles } from "lucide-react";

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContactAdded: (newContact: any) => void;
}

export function AddContactModal({ isOpen, onClose, onContactAdded }: AddContactModalProps) {
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [company, setCompany] = useState("");
  const [tagsInput, setTagsInput] = useState("Lead: High Intent, Enterprise");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !phoneNumber.trim()) {
      setError("Contact name and phone number are required.");
      return;
    }

    setLoading(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phoneNumber: phoneNumber.trim(),
          company: company.trim(),
          tags,
          customAttributes: notes ? { internalNotes: notes.trim() } : {},
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to create contact");
      }

      onContactAdded(json.data);
      onClose();
      // Reset form
      setName("");
      setPhoneNumber("");
      setCompany("");
      setTagsInput("Lead: High Intent, Enterprise");
      setNotes("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-[#0e131b] border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-surface-100/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-whatsapp/20 border border-whatsapp/30 flex items-center justify-center text-whatsapp-light">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Add New Contact</h2>
              <p className="text-xs text-gray-400">Register recipient for WhatsApp messaging</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-gray-300 font-semibold mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Priya Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light transition-all text-xs"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1">
              WhatsApp Phone Number (E.164 with Country Code) *
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                required
                placeholder="e.g. +91 98765 43210 or +1 415 555 0199"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white font-mono placeholder-gray-500 focus:outline-none focus:border-whatsapp-light transition-all text-xs"
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              Must include country code without zero prefix.
            </p>
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1">Company / Organization</label>
            <div className="relative">
              <Building className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="e.g. Acme Tech Solutions"
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
                placeholder="Lead: High Intent, Enterprise, Retail"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light transition-all text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1">Internal Notes</label>
            <textarea
              rows={2}
              placeholder="Initial customer requirements, context or stage..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light transition-all text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
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
                  <span>Save Contact</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

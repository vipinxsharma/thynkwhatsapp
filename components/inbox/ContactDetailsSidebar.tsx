"use client";

import { useState } from "react";
import { Contact, Conversation, PhoneNumber } from "@/types/strapi";
import {
  User,
  Phone,
  Tag,
  Plus,
  X,
  Building,
  CheckCircle2,
  Copy,
  Check,
  Briefcase,
} from "lucide-react";
import { formatPhoneNumber } from "@/lib/utils";

interface ContactDetailsSidebarProps {
  conversation: Conversation;
  onUpdateTags: (tags: string[]) => void;
  onUpdateStatus: (status: Conversation["status"]) => void;
}

export function ContactDetailsSidebar({
  conversation,
  onUpdateTags,
  onUpdateStatus,
}: ContactDetailsSidebarProps) {
  const [newTag, setNewTag] = useState("");
  const [copied, setCopied] = useState(false);
  const contact = conversation.contact;

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(contact.phoneNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    const currentTags = contact.tags || [];
    if (!currentTags.includes(newTag.trim())) {
      onUpdateTags([...currentTags, newTag.trim()]);
    }
    setNewTag("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = contact.tags || [];
    onUpdateTags(currentTags.filter((t) => t !== tagToRemove));
  };

  return (
    <div className="w-72 flex-shrink-0 flex flex-col border-l border-white/5 bg-[#0e131b] p-4 overflow-y-auto space-y-5">
      {/* Profile Header */}
      <div className="text-center pb-4 border-b border-white/5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 mx-auto flex items-center justify-center text-white text-2xl font-bold shadow-glow mb-3">
          {contact.name.charAt(0)}
        </div>
        <h3 className="text-base font-bold text-white tracking-tight">{contact.name}</h3>
        <button
          onClick={handleCopyPhone}
          className="mt-1 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-all font-mono"
        >
          <Phone className="w-3 h-3 text-whatsapp-light" />
          <span>{formatPhoneNumber(contact.phoneNumber)}</span>
          {copied ? (
            <Check className="w-3 h-3 text-whatsapp-light" />
          ) : (
            <Copy className="w-3 h-3 text-gray-500" />
          )}
        </button>
      </div>

      {/* Conversation Status */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Conversation Status
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {(["open", "pending", "closed"] as const).map((st) => (
            <button
              key={st}
              onClick={() => onUpdateStatus(st)}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                conversation.status === st
                  ? "bg-whatsapp/20 text-whatsapp-light border border-whatsapp/40 shadow-sm"
                  : "bg-white/[0.03] text-gray-400 hover:bg-white/5"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* CRM Tags */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            <span>CRM Tags</span>
          </label>
          <span className="text-[10px] text-gray-500">{(contact.tags || []).length} tags</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(contact.tags || []).map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-surface-50 border border-white/10 text-gray-200"
            >
              <span>{t}</span>
              <button
                onClick={() => handleRemoveTag(t)}
                className="hover:text-red-400 transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>

        <form onSubmit={handleAddTag} className="flex gap-1.5 mt-2">
          <input
            type="text"
            placeholder="Add tag (e.g. VIP, Deal)..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-white/5 border border-white/5 text-gray-200 focus:outline-none focus:border-whatsapp-light/40"
          />
          <button
            type="submit"
            className="p-1.5 rounded-lg bg-white/10 text-gray-300 hover:text-white hover:bg-white/15 transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Custom CRM Attributes */}
      {contact.customAttributes && Object.keys(contact.customAttributes).length > 0 && (
        <div className="space-y-2 border-t border-white/5 pt-4">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5" />
            <span>CRM Properties</span>
          </label>
          <div className="space-y-1.5 text-xs">
            {Object.entries(contact.customAttributes).map(([key, val]) => (
              <div
                key={key}
                className="p-2 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between"
              >
                <span className="text-gray-400 capitalize">{key}</span>
                <span className="font-semibold text-gray-200">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta WABA Channel Details */}
      <div className="space-y-2 border-t border-white/5 pt-4 text-xs">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Channel Info
        </label>
        <div className="p-2.5 rounded-lg bg-surface-50 border border-white/5 space-y-1 text-[11px] text-gray-400">
          <div className="flex justify-between">
            <span>Sender:</span>
            <span className="text-gray-200 font-mono">
              {conversation.phoneNumber?.displayPhoneNumber || "+91 98765 43210"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Quality:</span>
            <span className="text-whatsapp-light font-bold">
              {conversation.phoneNumber?.qualityRating || "GREEN"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

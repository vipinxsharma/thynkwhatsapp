"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  MessageSquare,
  Tag,
  Clock,
  AlertCircle,
  Building,
  Phone,
  ArrowUpRight,
  Download,
} from "lucide-react";
import { initialConversations } from "@/lib/strapi/mock-data";
import { formatPhoneNumber, calculateWindowRemaining } from "@/lib/utils";

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [contacts, setContacts] = useState(
    initialConversations.map((c) => ({
      ...c.contact,
      conversationId: c.id,
      windowExpiresAt: c.windowExpiresAt,
      lastMessageAt: c.lastMessageAt,
    }))
  );

  const allTags = Array.from(
    new Set(contacts.flatMap((c) => c.tags || []))
  );

  const filteredContacts = contacts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phoneNumber.includes(search) ||
      (c.customAttributes?.company || "").toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedTag !== "all" && !(c.tags || []).includes(selectedTag)) return false;
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="pb-6 border-b border-white/5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">CRM Contacts</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-whatsapp/20 text-whatsapp-light border border-whatsapp/30 font-semibold uppercase">
              {filteredContacts.length} Total
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Enterprise customer profiles, custom attributes, tags, and active WhatsApp conversation windows.
          </p>
        </div>

        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-100 border border-white/10 hover:bg-surface-50 text-gray-300 text-xs font-semibold transition-all">
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-whatsapp-light hover:brightness-110 active:scale-95 text-black font-semibold text-xs transition-all shadow-glow">
            <Plus className="w-4 h-4" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Search & Tag Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, phone, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-100/80 border border-white/5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-whatsapp-light/50 transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedTag("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedTag === "all"
                ? "bg-whatsapp/20 text-whatsapp-light border border-whatsapp/30"
                : "bg-surface-100/60 border border-white/5 text-gray-400 hover:text-white"
            }`}
          >
            All Tags
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedTag === tag
                  ? "bg-whatsapp/20 text-whatsapp-light border border-whatsapp/30"
                  : "bg-surface-100/60 border border-white/5 text-gray-400 hover:text-white"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts Table */}
      <div className="rounded-2xl bg-surface-100/60 border border-white/5 overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0b0e14]/60 text-gray-400 uppercase tracking-wider border-b border-white/5 font-semibold">
            <tr>
              <th className="py-3 px-4">Contact</th>
              <th className="py-3 px-4">Company</th>
              <th className="py-3 px-4">Tags</th>
              <th className="py-3 px-4">24h Service Window</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredContacts.map((contact) => {
              const window = calculateWindowRemaining(contact.windowExpiresAt);

              return (
                <tr key={contact.id} className="hover:bg-white/[0.02] transition-colors">
                  {/* Name & Phone */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-bold text-xs shadow-glow">
                        {contact.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm">{contact.name}</p>
                        <p className="text-gray-400 font-mono text-[11px]">
                          {formatPhoneNumber(contact.phoneNumber)}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Company */}
                  <td className="py-3.5 px-4 text-gray-300">
                    <div className="flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-gray-500" />
                      <span>{contact.customAttributes?.company || "Individual"}</span>
                    </div>
                  </td>

                  {/* Tags */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {(contact.tags || []).map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-medium text-gray-300 border border-white/5"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* 24-Hour Window */}
                  <td className="py-3.5 px-4">
                    {window.isExpired ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                        <AlertCircle className="w-3 h-3" />
                        Expired (Template Req)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                        <Clock className="w-3 h-3" />
                        {window.formatted}
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      href="/inbox"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-whatsapp/15 hover:bg-whatsapp/25 border border-whatsapp/30 text-whatsapp-light font-semibold text-xs transition-all"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Open Chat</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

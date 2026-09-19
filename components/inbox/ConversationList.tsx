"use client";

import { useState } from "react";
import { Conversation } from "@/types/strapi";
import { Search, Clock, AlertCircle } from "lucide-react";
import { formatPhoneNumber, getRelativeTime, calculateWindowRemaining } from "@/lib/utils";

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: number | string | null;
  onSelectConversation: (id: number | string) => void;
}

export function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
}: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "expired">("all");

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      conv.contact.name.toLowerCase().includes(search.toLowerCase()) ||
      conv.contact.phoneNumber.includes(search) ||
      (conv.lastMessage?.body || "").toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === "unread") return conv.unreadCount > 0;
    if (filter === "expired") {
      return calculateWindowRemaining(conv.windowExpiresAt).isExpired;
    }
    return true;
  });

  return (
    <div className="w-80 flex-shrink-0 flex flex-col border-r border-white/5 bg-[#0e131b]">
      {/* Header & Search */}
      <div className="p-3 border-b border-white/5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white tracking-tight">Conversations</h2>
          <span className="text-xs text-gray-400 font-medium">
            {filteredConversations.length} total
          </span>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, number, or text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-whatsapp-light/50 focus:bg-white/[0.07] transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1">
          {(["all", "unread", "expired"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition-all ${
                filter === tab
                  ? "bg-whatsapp/20 text-whatsapp-light border border-whatsapp/30"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              {tab === "expired" ? "24h Expired" : tab}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03]">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">
            No conversations match your search.
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = String(conv.id) === String(activeConversationId);
            const window = calculateWindowRemaining(conv.windowExpiresAt);

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`p-3 cursor-pointer transition-all ${
                  isActive
                    ? "bg-whatsapp/10 border-l-4 border-l-whatsapp-light"
                    : "hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-700 to-teal-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {conv.contact.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-100 truncate">
                        {conv.contact.name}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {formatPhoneNumber(conv.contact.phoneNumber)}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] text-gray-500 flex-shrink-0">
                    {getRelativeTime(conv.lastMessageAt)}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-400 truncate flex-1">
                    {conv.lastMessage?.body || "No messages yet"}
                  </p>
                  {conv.unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-whatsapp-light text-black text-[10px] font-bold">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>

                {/* 24h Window Badge */}
                <div className="mt-2 flex items-center gap-1.5">
                  {window.isExpired ? (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                      <AlertCircle className="w-3 h-3" />
                      Template Required
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      <Clock className="w-3 h-3" />
                      {window.formatted}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

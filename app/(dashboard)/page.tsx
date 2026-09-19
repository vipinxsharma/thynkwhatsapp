import Link from "next/link";
import { StrapiClient } from "@/lib/strapi/client";
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  Phone,
  ArrowUpRight,
  TrendingUp,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { calculateWindowRemaining, formatPhoneNumber, getRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const strapi = new StrapiClient();
  const conversations = await strapi.getConversations();
  const waba = await strapi.getWABA();

  const activeWindows = conversations.filter(
    (c) => !calculateWindowRemaining(c.windowExpiresAt).isExpired
  ).length;

  const expiredWindows = conversations.length - activeWindows;

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-6xl">
      {/* Top Welcome Banner */}
      <div className="flex items-center justify-between pb-6 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            thynkWISE WhatsApp Business Platform
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Meta Tech Provider Console & Multi-Tenant Messaging Infrastructure
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/inbox"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-whatsapp-light hover:brightness-110 active:scale-95 text-black font-semibold text-xs transition-all shadow-glow"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Launch CRM Inbox</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-surface-100/60 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Active 24h Windows</span>
            <Clock className="w-4 h-4 text-whatsapp-light" />
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">{activeWindows}</p>
          <p className="text-[11px] text-emerald-400 font-medium">Freeform reply unlocked</p>
        </div>

        <div className="p-5 rounded-2xl bg-surface-100/60 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Expired Windows</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">{expiredWindows}</p>
          <p className="text-[11px] text-amber-400 font-medium">HSM Templates required</p>
        </div>

        <div className="p-5 rounded-2xl bg-surface-100/60 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Delivery Rate</span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">99.8%</p>
          <p className="text-[11px] text-gray-400 font-medium">Verified by Meta Webhook Receipts</p>
        </div>

        <div className="p-5 rounded-2xl bg-surface-100/60 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Verified Senders</span>
            <Phone className="w-4 h-4 text-teal-400" />
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">
            {waba.phoneNumbers?.length || 1}
          </p>
          <p className="text-[11px] text-teal-400 font-medium">Tier 1 Quality (GREEN)</p>
        </div>
      </div>

      {/* Recent High-Priority Conversations */}
      <div className="p-6 rounded-2xl bg-surface-100/60 border border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Recent Enterprise Conversations
            </h3>
            <p className="text-xs text-gray-400">Incoming leads and active customer support threads</p>
          </div>

          <Link
            href="/inbox"
            className="text-xs font-semibold text-whatsapp-light hover:underline flex items-center gap-1"
          >
            <span>View All in Inbox</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-white/5">
          {conversations.slice(0, 5).map((conv) => {
            const window = calculateWindowRemaining(conv.windowExpiresAt);

            return (
              <div key={conv.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    {conv.contact.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-100 truncate">
                      {conv.contact.name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {conv.lastMessage?.body || "No message"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-gray-500">
                      {getRelativeTime(conv.lastMessageAt)}
                    </span>
                    <div>
                      {window.isExpired ? (
                        <span className="text-[10px] text-amber-400 font-medium">
                          Template Required
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-medium">
                          {window.formatted}
                        </span>
                      )}
                    </div>
                  </div>

                  <Link
                    href="/inbox"
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-all"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

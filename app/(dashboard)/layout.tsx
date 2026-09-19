"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  FileText,
  Settings,
  LayoutDashboard,
  ShieldCheck,
  Building2,
  PhoneCall,
  Activity,
  Send,
} from "lucide-react";

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "CRM Inbox", href: "/inbox", icon: MessageSquare, badge: "3" },
  { name: "Broadcasts", href: "/campaigns", icon: Send },
  { name: "HSM Templates", href: "/templates", icon: FileText },
  { name: "WABA Settings", href: "/settings/waba", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-[#090c10] text-gray-200 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-white/5 bg-[#0d1117]/80 backdrop-blur-md">
        {/* Brand */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center shadow-glow">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-base tracking-tight">thynkWISE</span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-whatsapp/20 text-whatsapp-light border border-whatsapp/30">
                SaaS
              </span>
            </div>
            <p className="text-[11px] text-gray-400">Meta Tech Provider</p>
          </div>
        </div>

        {/* Tenant Switcher / Context */}
        <div className="p-3">
          <div className="p-2.5 rounded-lg bg-surface-100/60 border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-gray-400" />
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-gray-200 truncate">Acme Global</p>
                <p className="text-[10px] text-gray-400 font-mono">WABA: 109823485</p>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-whatsapp-light animate-pulse" title="Connected" />
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 space-y-1 mt-2">
          {navigation.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-whatsapp/15 text-whatsapp-light border border-whatsapp/20 shadow-sm"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? "text-whatsapp-light" : "text-gray-400"}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      isActive
                        ? "bg-whatsapp-light text-black"
                        : "bg-white/10 text-gray-300"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Health & Security Footer */}
        <div className="p-4 border-t border-white/5 space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-whatsapp-light" />
            <span>AES-256 Encrypted Tokens</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>Webhook: Active (v21.0)</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#090c10]">
        {children}
      </div>
    </div>
  );
}

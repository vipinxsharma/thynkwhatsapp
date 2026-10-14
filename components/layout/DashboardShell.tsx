"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppSession } from "@/lib/auth/session";
import { signOutAction } from "@/app/auth/actions";
import type { WorkspaceMembership } from "@/lib/workspaces/store";
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Send,
  Settings,
  ShieldCheck,
  Users,
  LifeBuoy,
  UserPlus,
} from "lucide-react";

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "CRM Inbox", href: "/inbox", icon: MessageSquare, badge: "3" },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Automations", href: "/automations", icon: Bot },
  { name: "Broadcasts", href: "/campaigns", icon: Send },
  { name: "HSM Templates", href: "/templates", icon: FileText },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "WABA Settings", href: "/settings/waba", icon: Settings },
  { name: "Support", href: "/support", icon: LifeBuoy },
];

export function DashboardShell({
  children,
  session,
  memberships,
}: {
  children: React.ReactNode;
  session: AppSession;
  memberships: WorkspaceMembership[];
}) {
  const pathname = usePathname();

  async function switchWorkspace(workspaceId: string) {
    if (workspaceId === session.tenantId) return;
    const response = await fetch("/api/workspaces/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    if (response.ok) window.location.assign("/");
  }

  const visibleNavigation = session.role === "owner" || session.role === "admin"
    ? [...navigation, { name: "Team", href: "/settings/team", icon: UserPlus }]
    : navigation;

  return (
    <div className="flex h-screen bg-[#090c10] text-gray-200 overflow-hidden">
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-white/5 bg-[#0d1117]/80 backdrop-blur-md">
        <div className="h-16 px-6 flex items-center gap-3 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center shadow-glow">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-base tracking-tight">Xeccel</span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-whatsapp/20 text-whatsapp-light border border-whatsapp/30">
                SaaS
              </span>
            </div>
            <p className="text-[11px] text-gray-400">Meta Tech Provider</p>
          </div>
        </div>

        <div className="p-3">
          <div className="p-2.5 rounded-lg bg-surface-100/60 border border-white/5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-gray-400" />
            </div>
            <div className="min-w-0 flex-1 truncate">
              {memberships.length > 1 ? (
                <select aria-label="Current workspace" value={session.tenantId} onChange={(event) => switchWorkspace(event.target.value)} className="w-full bg-transparent text-xs font-semibold text-gray-200 outline-none">
                  {memberships.map((membership) => <option key={membership.workspaceId} value={membership.workspaceId}>{membership.workspaceName}</option>)}
                </select>
              ) : <p className="truncate text-xs font-semibold text-gray-200">{session.tenantName}</p>}
              <p className="text-[10px] text-gray-400 truncate">{session.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-2">
          {visibleNavigation.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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
                      isActive ? "bg-whatsapp-light text-black" : "bg-white/10 text-gray-300"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-3">
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-whatsapp-light" />
            <span>Tenant session enforced</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span className="capitalize">Role: {session.role}</span>
          </div>
          <form action={signOutAction}>
            <button className="text-[11px] text-gray-400 hover:text-white">Sign out</button>
          </form>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#090c10]">{children}</div>
    </div>
  );
}

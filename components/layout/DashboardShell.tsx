"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import type { AppSession } from "@/lib/auth/session";
import { signOutAction } from "@/app/auth/actions";
import type { WorkspaceMembership } from "@/lib/workspaces/store";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { XeccelLogo } from "@/components/brand/XeccelLogo";
import {
  Menu,
  X,
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
  PlugZap,
  ShoppingBag,
  Smartphone,
  Sparkles,
  UserPlus,
} from "lucide-react";

const navigation = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Team inbox", href: "/inbox", icon: MessageSquare },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Automations", href: "/automations", icon: Bot },
  { name: "Campaigns", href: "/campaigns", icon: Send },
  { name: "Message templates", href: "/templates", icon: FileText },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Channels", href: "/settings/waba", icon: Settings },
  { name: "Support", href: "/support", icon: LifeBuoy },
];

const roadmapNavigation = [
  { name: "AI Agents", href: "/ai-agents", icon: Sparkles },
  { name: "Integrations", href: "/integrations", icon: PlugZap },
  { name: "Commerce & Ads", href: "/growth", icon: ShoppingBag },
];

const phaseTwoNavigation = [{ name: "SMS Gateway", href: "/sms", icon: Smartphone }];

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
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  async function switchWorkspace(workspaceId: string) {
    if (workspaceId === session.tenantId) return;
    const response = await fetch("/api/workspaces/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    if (response.ok) window.location.assign("/dashboard");
  }

  const visibleNavigation = session.role === "owner" || session.role === "admin"
    ? [...navigation, { name: "Team", href: "/settings/team", icon: UserPlus }]
    : navigation;

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)] md:flex-row">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-lg focus:bg-[var(--surface)] focus:p-3">Skip to content</a>
      <header className="flex min-h-20 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 md:hidden">
        <Link href="/dashboard" aria-label="Xeccel workspace home"><XeccelLogo size="sidebar" /></Link>
        <button type="button" aria-expanded={mobileNavigationOpen} aria-controls="workspace-navigation" onClick={() => setMobileNavigationOpen((open) => !open)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold">
          {mobileNavigationOpen ? <X className="size-4" aria-hidden="true" /> : <Menu className="size-4" aria-hidden="true" />} {mobileNavigationOpen ? "Close menu" : "Menu"}
        </button>
      </header>
      <aside id="workspace-navigation" aria-label="Workspace navigation" className={`${mobileNavigationOpen ? "flex" : "hidden"} max-h-[65dvh] w-full shrink-0 flex-col border-b border-[var(--border)] bg-[var(--surface)] md:flex md:max-h-none md:w-64 md:border-b-0 md:border-r`}>
        <div className="hidden h-24 shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 md:flex">
          <XeccelLogo size="sidebar" priority />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-whatsapp/20 text-[var(--foreground)] border border-whatsapp/30">
                SaaS
              </span>
            </div>
            <p className="text-[11px] text-[var(--muted)]">WhatsApp Business Platform</p>
          </div>
        </div>

        <div className="p-3">
          <div className="p-2.5 rounded-lg bg-surface-100/60 border border-[var(--border)] flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-surface-200 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-[var(--muted)]" />
            </div>
            <div className="min-w-0 flex-1 truncate">
              {memberships.length > 1 ? (
                <select aria-label="Current workspace" value={session.tenantId} onChange={(event) => switchWorkspace(event.target.value)} className="w-full bg-transparent text-xs font-semibold text-[var(--foreground)]">
                  {memberships.map((membership) => <option key={membership.workspaceId} value={membership.workspaceId}>{membership.workspaceName}</option>)}
                </select>
              ) : <p className="truncate text-xs font-semibold text-[var(--foreground)]">{session.tenantName}</p>}
              <p className="text-[10px] text-[var(--muted)] truncate">{session.email}</p>
            </div>
          </div>
        </div>

        <nav aria-label="Workspace sections" className="mt-2 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
          {[...visibleNavigation, ...roadmapNavigation, ...phaseTwoNavigation].map((item, index) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <div key={item.name}>
                {index === visibleNavigation.length && (
                  <p className="px-3 pb-1 pt-5 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Explore · Planned</p>
                )}
                {index === visibleNavigation.length + roadmapNavigation.length && (
                  <p className="px-3 pb-1 pt-5 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Additional channels</p>
                )}
                <Link
                  href={item.href}
                  onClick={() => setMobileNavigationOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-whatsapp/15 text-[var(--foreground)] border border-whatsapp/30 shadow-sm"
                      : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-surface-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-whatsapp-dark" : "text-[var(--muted)]"}`} />
                    <span>{item.name}</span>
                  </div>
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[var(--border)] space-y-3">
          <ThemeToggle className="w-full" />
          <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
            <ShieldCheck className="w-3.5 h-3.5 text-whatsapp-light" />
            <span>Protected workspace</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
            <Activity className="w-3.5 h-3.5 text-[var(--muted)]" />
            <span className="capitalize">Role: {session.role}</span>
          </div>
          <form action={signOutAction}>
            <button className="min-h-11 text-[11px] text-[var(--muted)] hover:text-[var(--foreground)]">Sign out</button>
          </form>
        </div>
      </aside>

      <main id="main-content" className="theme-content flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--background)]">{children}</main>
    </div>
  );
}

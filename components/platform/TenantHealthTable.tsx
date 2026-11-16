import type { PlatformTenantHealth, PlatformTenantHealthStatus } from "@/lib/workspaces/store";
import { platformTenantHealthStatus } from "@/lib/workspaces/store";

export interface TenantHealthRow {
  workspaceId: string;
  workspaceName: string;
  createdAt: string;
  health: PlatformTenantHealth | undefined;
}

const statusStyle: Record<PlatformTenantHealthStatus, string> = {
  Active: "text-emerald-300",
  Idle: "text-[var(--muted)]",
  "No channel": "text-amber-300",
  "Send failures": "text-red-300",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function TenantHealthTable({ rows }: { rows: TenantHealthRow[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Tenant health</h2>
      <p className="mb-4 mt-1 text-sm text-[var(--muted)]">
        Counts from recorded messages. Status: Active means a message in the last 7 days, Idle means none, No channel means no enabled WhatsApp number, Send failures means a failed outbound message in the last 7 days.
      </p>
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-semibold">Workspace</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Channels</th>
              <th className="px-5 py-3 font-semibold">Conversations</th>
              <th className="px-5 py-3 font-semibold">Outbound 7d</th>
              <th className="px-5 py-3 font-semibold">Failed 7d</th>
              <th className="px-5 py-3 font-semibold">Last inbound</th>
              <th className="px-5 py-3 font-semibold">Last outbound</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const status = platformTenantHealthStatus(row.health);
              return (
                <tr key={row.workspaceId} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-5 py-4 font-medium">{row.workspaceName}</td>
                  <td className={`px-5 py-4 font-semibold ${statusStyle[status]}`}>{status}</td>
                  <td className="px-5 py-4">{row.health?.enabledChannels ?? 0}</td>
                  <td className="px-5 py-4">{row.health?.conversations ?? 0}</td>
                  <td className="px-5 py-4">{row.health?.outbound7d ?? 0}</td>
                  <td className="px-5 py-4">{row.health?.failed7d ?? 0}</td>
                  <td className="px-5 py-4 text-[var(--muted)]">{formatDate(row.health?.lastInboundAt)}</td>
                  <td className="px-5 py-4 text-[var(--muted)]">{formatDate(row.health?.lastOutboundAt)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-[var(--muted)]">No workspaces yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

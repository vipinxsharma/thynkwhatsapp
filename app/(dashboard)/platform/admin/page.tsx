import { requirePageSession } from "@/lib/auth/session";
import { requirePlatformSuperadmin } from "@/lib/auth/platform-admin";
import { listPlatformWorkspaceSummaries } from "@/lib/workspaces/store";

export const dynamic = "force-dynamic";

export default async function PlatformAdminPage() {
  const session = await requirePageSession();
  await requirePlatformSuperadmin(session);
  const workspaces = await listPlatformWorkspaceSummaries();

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">Platform administration</p>
        <h1 className="mt-2 text-2xl font-bold">Workspaces</h1>
        <p className="mb-6 mt-2 text-sm text-[var(--muted)]">
          Read-only directory of Xeccel workspaces. Customer conversations and workspace settings are not exposed here.
        </p>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3 font-semibold">Workspace</th>
                <th className="px-5 py-3 font-semibold">Slug</th>
                <th className="px-5 py-3 font-semibold">Active members</th>
                <th className="px-5 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {workspaces.map((workspace) => (
                <tr key={workspace.workspaceId} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-5 py-4 font-medium">{workspace.workspaceName}</td>
                  <td className="px-5 py-4 text-[var(--muted)]">{workspace.workspaceSlug}</td>
                  <td className="px-5 py-4">{workspace.activeMembers}</td>
                  <td className="px-5 py-4 text-[var(--muted)]">
                    {new Date(workspace.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                  </td>
                </tr>
              ))}
              {workspaces.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--muted)]">No workspaces yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

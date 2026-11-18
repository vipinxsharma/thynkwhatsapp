"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  MessageSquare,
  Clock,
  AlertCircle,
  Building,
  Download,
  Upload,
  Edit,
  Trash2,
  RefreshCw,
  Settings,
  BellOff,
  Bell,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatPhoneNumber, calculateWindowRemaining } from "@/lib/utils";
import { AddContactModal } from "@/components/contacts/AddContactModal";
import { EditContactModal } from "@/components/contacts/EditContactModal";
import { CsvImportModal } from "@/components/contacts/CsvImportModal";
import { useContactMeta } from "@/components/contacts/contact-meta";

type ContactRow = {
  id: string | number;
  name: string;
  phoneNumber: string;
  waId?: string;
  tags?: string[];
  groupIds?: string[];
  consentStatus?: "subscribed" | "unsubscribed";
  customAttributes?: Record<string, any>;
  windowExpiresAt?: string | null;
};

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

const PAGE_SIZE = 25;

const selectClass =
  "px-3 py-2 rounded-lg bg-surface-100/80 border border-white/5 text-xs text-gray-200 focus:outline-none focus:border-whatsapp-light/50 transition-all";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [groupFilter, setGroupFilter] = useState("");
  const [consentFilter, setConsentFilter] = useState<"all" | "subscribed" | "unsubscribed">("all");
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkGroupId, setBulkGroupId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRow | null>(null);

  const { groups, refresh: refreshMeta } = useContactMeta(true);
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const requestCounter = useRef(0);

  // Debounce the search box so typing does not send a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchContacts = async () => {
    const requestId = ++requestCounter.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (selectedTag !== "all") params.set("tag", selectedTag);
      if (groupFilter) params.set("group", groupFilter);
      if (consentFilter !== "all") params.set("consent", consentFilter);

      const res = await fetch(`/api/contacts?${params.toString()}`);
      const json = await res.json();
      if (requestId !== requestCounter.current) return;
      if (!res.ok) throw new Error(json.error || "Failed to load contacts");
      setContacts(json.data || []);
      setPagination(json.pagination || { page, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
      setTagOptions(json.tags || []);
      setPageError("");
    } catch (err: any) {
      if (requestId === requestCounter.current) setPageError(err.message || "Failed to load contacts");
    } finally {
      if (requestId === requestCounter.current) setLoading(false);
    }
  };

  useEffect(() => {
    void fetchContacts();
    // Re-run when any filter or the page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, selectedTag, groupFilter, consentFilter]);

  const refreshAll = async () => {
    setSelectedIds(new Set());
    await Promise.all([fetchContacts(), refreshMeta()]);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allOnPageSelected = contacts.length > 0 && contacts.every((c) => selectedIds.has(String(c.id)));
  const toggleAllOnPage = () => {
    setSelectedIds(allOnPageSelected ? new Set() : new Set(contacts.map((c) => String(c.id))));
  };

  const runBulk = async (task: () => Promise<Response>, successMessage: string) => {
    setBulkBusy(true);
    setPageError("");
    try {
      const res = await task();
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      setSelectedIds(new Set());
      await fetchContacts();
      return successMessage;
    } catch (err: any) {
      setPageError(err.message || "Action failed");
      return "";
    } finally {
      setBulkBusy(false);
    }
  };

  const applyBulkGroup = async () => {
    if (!bulkGroupId || selectedIds.size === 0) return;
    await runBulk(
      () =>
        fetch("/api/contacts/groups/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId: bulkGroupId, contactIds: Array.from(selectedIds) }),
        }),
      "Added to group",
    );
    await refreshMeta();
  };

  const setConsent = async (ids: string[], status: "subscribed" | "unsubscribed") => {
    if (ids.length === 0) return;
    if (status === "unsubscribed" && !confirm(`Unsubscribe ${ids.length} contact(s) from marketing messages?`)) return;
    await runBulk(
      () =>
        fetch("/api/contacts/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactIds: ids, status }),
        }),
      status === "unsubscribed" ? "Unsubscribed" : "Resubscribed",
    );
  };

  const handleExportCsv = () => {
    if (contacts.length === 0) return;

    const headers = ["Name", "PhoneNumber", "WhatsAppId", "Company", "Tags", "Groups", "Consent", "24hWindowExpiresAt"];
    const rows = contacts.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.phoneNumber}"`,
      `"${c.waId || ""}"`,
      `"${String(c.customAttributes?.company || "").replace(/"/g, '""')}"`,
      `"${(c.tags || []).join("; ")}"`,
      `"${(c.groupIds || []).map((id) => groupNames.get(id) || "").filter(Boolean).join("; ")}"`,
      `"${c.consentStatus || "subscribed"}"`,
      `"${c.windowExpiresAt || ""}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `xeccel_contacts_page${pagination.page}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteContact = async (id: string | number) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;

    try {
      const res = await fetch(`/api/contacts?id=${id}`, { method: "DELETE" });
      if (res.ok) await refreshAll();
    } catch (err) {
      console.error("Failed to delete contact:", err);
    }
  };

  const rangeStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const rangeEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="pb-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">CRM Contacts</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-whatsapp/20 text-whatsapp-light border border-whatsapp/30 font-semibold uppercase">
              {pagination.total} Total
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Customer profiles, groups, custom fields, tags, opt-in status and 24-hour service windows.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => void refreshAll()}
            className="p-2 rounded-lg bg-surface-100 border border-white/10 hover:bg-surface-50 text-gray-400 hover:text-white transition-all"
            title="Refresh contacts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-whatsapp-light" : ""}`} />
          </button>
          <Link
            href="/contacts/settings"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-100 border border-white/10 hover:bg-surface-50 text-gray-300 text-xs font-semibold transition-all"
          >
            <Settings className="w-3.5 h-3.5 text-gray-400" />
            <span>Groups &amp; fields</span>
          </Link>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-100 border border-white/10 hover:bg-surface-50 text-gray-300 text-xs font-semibold transition-all"
          >
            <Upload className="w-3.5 h-3.5 text-teal-400" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={handleExportCsv}
            disabled={contacts.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-100 border border-white/10 hover:bg-surface-50 text-gray-300 text-xs font-semibold transition-all disabled:opacity-50"
            title="Exports the contacts on this page"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export page CSV</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-whatsapp-light hover:brightness-110 active:scale-95 text-black font-semibold text-xs transition-all shadow-glow"
          >
            <Plus className="w-4 h-4" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, phone, company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-100/80 border border-white/5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-whatsapp-light/50 transition-all"
            />
          </div>
          <select
            value={groupFilter}
            onChange={(e) => {
              setGroupFilter(e.target.value);
              setPage(1);
            }}
            className={selectClass}
            aria-label="Filter by group"
          >
            <option value="">All groups</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.memberCount})
              </option>
            ))}
          </select>
          <select
            value={selectedTag}
            onChange={(e) => {
              setSelectedTag(e.target.value);
              setPage(1);
            }}
            className={selectClass}
            aria-label="Filter by tag"
          >
            <option value="all">All tags</option>
            {tagOptions.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <select
            value={consentFilter}
            onChange={(e) => {
              setConsentFilter(e.target.value as "all" | "subscribed" | "unsubscribed");
              setPage(1);
            }}
            className={selectClass}
            aria-label="Filter by opt-in status"
          >
            <option value="all">Any opt-in status</option>
            <option value="subscribed">Subscribed</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
        </div>
      </div>

      {pageError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{pageError}</div>
      )}

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-whatsapp/10 border border-whatsapp/30 text-xs">
          <span className="font-semibold text-whatsapp-light">{selectedIds.size} selected</span>
          <select value={bulkGroupId} onChange={(e) => setBulkGroupId(e.target.value)} className={selectClass} aria-label="Group to add selected contacts to">
            <option value="">Add to group…</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <button
            onClick={applyBulkGroup}
            disabled={!bulkGroupId || bulkBusy}
            className="px-3 py-2 rounded-lg bg-whatsapp/20 hover:bg-whatsapp/30 text-whatsapp-light border border-whatsapp/30 font-semibold disabled:opacity-50"
          >
            Apply
          </button>
          <button
            onClick={() => setConsent(Array.from(selectedIds), "unsubscribed")}
            disabled={bulkBusy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 font-semibold disabled:opacity-50"
          >
            <BellOff className="w-3.5 h-3.5" />
            Unsubscribe
          </button>
          <button
            onClick={() => setConsent(Array.from(selectedIds), "subscribed")}
            disabled={bulkBusy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 font-semibold disabled:opacity-50"
          >
            <Bell className="w-3.5 h-3.5" />
            Resubscribe
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-gray-400 hover:text-white">
            Clear selection
          </button>
        </div>
      )}

      {/* Contacts Table */}
      <div className="rounded-2xl bg-surface-100/60 border border-white/5 overflow-x-auto shadow-xl">
        <table className="w-full text-left text-xs min-w-[860px]">
          <thead className="bg-[var(--surface-muted)] text-gray-400 uppercase tracking-wider border-b border-white/5 font-semibold">
            <tr>
              <th className="py-3 px-4 w-10">
                <input
                  type="checkbox"
                  aria-label="Select all contacts on this page"
                  checked={allOnPageSelected}
                  onChange={toggleAllOnPage}
                  className="accent-emerald-500"
                />
              </th>
              <th className="py-3 px-4">Contact</th>
              <th className="py-3 px-4">Company</th>
              <th className="py-3 px-4">Groups</th>
              <th className="py-3 px-4">Tags</th>
              <th className="py-3 px-4">Opt-in</th>
              <th className="py-3 px-4">24h Service Window</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-500">
                  {loading ? "Loading CRM contacts..." : "No contacts found matching your criteria."}
                </td>
              </tr>
            ) : (
              contacts.map((contact) => {
                const window = calculateWindowRemaining(contact.windowExpiresAt ?? "");
                const id = String(contact.id);
                const unsubscribed = contact.consentStatus === "unsubscribed";

                return (
                  <tr key={id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4">
                      <input
                        type="checkbox"
                        aria-label={`Select ${contact.name}`}
                        checked={selectedIds.has(id)}
                        onChange={() => toggleSelected(id)}
                        className="accent-emerald-500"
                      />
                    </td>

                    {/* Name & Phone */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-bold text-xs shadow-glow">
                          {contact.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-white text-sm">{contact.name}</p>
                          <p className="text-gray-400 font-mono text-[11px]">{formatPhoneNumber(contact.phoneNumber)}</p>
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

                    {/* Groups */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[12rem]">
                        {(contact.groupIds || []).map((groupId) => (
                          <span
                            key={groupId}
                            className="px-2 py-0.5 rounded-md bg-whatsapp/10 text-[10px] font-medium text-whatsapp-light border border-whatsapp/20"
                          >
                            {groupNames.get(groupId) || "Group"}
                          </span>
                        ))}
                        {(contact.groupIds || []).length === 0 && <span className="text-gray-600">—</span>}
                      </div>
                    </td>

                    {/* Tags */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(contact.tags || []).map((t: string) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-medium text-gray-300 border border-white/5"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Opt-in */}
                    <td className="py-3.5 px-4">
                      {unsubscribed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                          <BellOff className="w-3 h-3" />
                          Unsubscribed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10 font-medium">
                          <Bell className="w-3 h-3" />
                          Subscribed
                        </span>
                      )}
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
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => setConsent([id], unsubscribed ? "subscribed" : "unsubscribed")}
                          disabled={bulkBusy}
                          className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all text-[11px] font-semibold disabled:opacity-50"
                          title={unsubscribed ? "Resubscribe contact" : "Unsubscribe contact"}
                        >
                          {unsubscribed ? "Resubscribe" : "Unsubscribe"}
                        </button>
                        <button
                          onClick={() => setEditingContact(contact)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                          title="Edit Contact"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all"
                          title="Delete Contact"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <Link
                          href="/inbox"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-whatsapp/15 hover:bg-whatsapp/25 border border-whatsapp/30 text-whatsapp-light font-semibold text-xs transition-all"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          {pagination.total === 0 ? "No contacts" : `Showing ${rangeStart}–${rangeEnd} of ${pagination.total}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={pagination.page <= 1 || loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-100 border border-white/10 text-gray-300 hover:text-white disabled:opacity-40"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
            disabled={pagination.page >= pagination.totalPages || loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-100 border border-white/10 text-gray-300 hover:text-white disabled:opacity-40"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onContactAdded={() => void refreshAll()}
      />

      {/* Edit Contact Modal */}
      <EditContactModal
        isOpen={!!editingContact}
        contact={editingContact}
        onClose={() => setEditingContact(null)}
        onContactUpdated={() => void refreshAll()}
        onContactDeleted={() => void refreshAll()}
      />

      {/* CSV Bulk Import Modal */}
      <CsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={() => void refreshAll()}
      />
    </div>
  );
}

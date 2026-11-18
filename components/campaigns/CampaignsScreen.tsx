"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BatchSummary } from "@/lib/campaigns/sender";
import type { Campaign, CampaignStatus, ConsentContact, ConsentStatus, RecipientProblem } from "@/lib/campaigns/store";
import {
  CAMPAIGN_STATUS_LABELS, CONSENT_BATCH_LIMIT, POLL_INTERVAL_MS, type CampaignAction, type SelectableTemplate,
  actionsForStatus, audienceFromContacts, batchSummaryLines, campaignStatusStyle, canManageCampaigns, confirmationCopy,
  consentLabel, countRows, errorFromBody, filterConsentContacts, formatCount, formatDateTime, newCampaignId,
  previewBody, problemLabel, problemReason, roleLimitMessage, shouldPoll, tagsFromContacts, VARIABLE_HELPERS,
  variableProblem,
} from "@/components/campaigns/campaign-helpers";

export interface ChannelOption {
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
  channelName: string | null;
  enabled: boolean;
  isDefault: boolean;
}

interface Props {
  role: string;
  channels: ChannelOption[];
  templates: SelectableTemplate[];
}

interface CampaignDetailData {
  campaign: Campaign;
  problems: RecipientProblem[];
}

const JSON_HEADERS = { "Content-Type": "application/json" };

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export function CampaignsScreen({ role, channels, templates }: Props) {
  const canManage = canManageCampaigns(role);
  const roleNote = roleLimitMessage(role);
  const [tab, setTab] = useState<"campaigns" | "consent">("campaigns");

  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [contacts, setContacts] = useState<ConsentContact[] | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    try {
      const response = await fetch("/api/campaigns", { cache: "no-store" });
      const body = await readJson(response);
      if (!response.ok) throw new Error(errorFromBody(body, "Campaigns are unavailable right now."));
      setCampaigns((body as { data: Campaign[] }).data);
      setListError(null);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Campaigns are unavailable right now.");
    }
  }, []);

  const loadConsent = useCallback(async () => {
    try {
      const response = await fetch("/api/campaigns/consent", { cache: "no-store" });
      const body = await readJson(response);
      if (!response.ok) throw new Error(errorFromBody(body, "Contacts are unavailable right now."));
      setContacts((body as { data: ConsentContact[] }).data);
      setConsentError(null);
    } catch (error) {
      setConsentError(error instanceof Error ? error.message : "Contacts are unavailable right now.");
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
    void loadConsent();
  }, [loadCampaigns, loadConsent]);

  // Keep the list in step while any campaign is sending.
  const anySending = campaigns?.some((campaign) => shouldPoll(campaign.status)) ?? false;
  useEffect(() => {
    if (!anySending) return;
    const timer = window.setInterval(() => void loadCampaigns(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [anySending, loadCampaigns]);

  const openCampaign = (id: string) => {
    setCreating(false);
    setSelectedId(id);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6">
      <div className="border-b border-white/5 pb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="mt-1 text-sm text-gray-400">
            Send an approved template to opted-in contacts. Every recipient must have marketing consent.
          </p>
        </div>
        <div className="flex gap-2">
          <TabButton active={tab === "campaigns"} onClick={() => setTab("campaigns")}>Campaigns</TabButton>
          <TabButton active={tab === "consent"} onClick={() => setTab("consent")}>Consent</TabButton>
        </div>
      </div>

      {roleNote && (
        <div role="note" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          {roleNote}
        </div>
      )}

      {tab === "campaigns" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <section className="xl:col-span-1 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Your campaigns</h2>
              <button
                type="button"
                disabled={!canManage}
                onClick={() => { setCreating(true); setSelectedId(null); }}
                className="rounded-lg bg-whatsapp px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
              >
                New campaign
              </button>
            </div>
            {listError && <p role="alert" className="text-sm text-red-300">{listError}</p>}
            {campaigns === null && !listError && <p className="text-sm text-gray-400">Loading campaigns…</p>}
            {campaigns?.length === 0 && <p className="text-sm text-gray-400">No campaigns yet.</p>}
            <ul className="space-y-3">
              {campaigns?.map((campaign) => (
                <li key={campaign.id}>
                  <button
                    type="button"
                    onClick={() => openCampaign(campaign.id)}
                    className={`w-full text-left rounded-xl border p-4 transition-colors ${
                      selectedId === campaign.id ? "border-whatsapp bg-white/10" : "border-white/10 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white truncate">{campaign.name}</span>
                      <StatusBadge status={campaign.status} />
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {formatCount(campaign.counts.total)} recipients · {formatCount(campaign.counts.sent)} sent · {formatCount(campaign.counts.failed)} failed
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Created {formatDateTime(campaign.createdAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="xl:col-span-2">
            {creating && (
              <CreateCampaignForm
                channels={channels}
                templates={templates}
                contacts={contacts}
                canManage={canManage}
                onCancel={() => setCreating(false)}
                onCreated={(id) => { setCreating(false); void loadCampaigns(); setSelectedId(id); }}
              />
            )}
            {!creating && selectedId && (
              <CampaignDetail
                key={selectedId}
                campaignId={selectedId}
                canManage={canManage}
                onChanged={() => void loadCampaigns()}
              />
            )}
            {!creating && !selectedId && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-gray-400">
                Select a campaign to see its progress, or create a new one.
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "consent" && (
        <ConsentPanel
          contacts={contacts}
          error={consentError}
          canManage={canManage}
          onChanged={() => void loadConsent()}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg px-3 py-2 text-sm font-semibold border ${
        active ? "border-whatsapp bg-whatsapp/20 text-white" : "border-white/10 text-gray-300 hover:border-white/30"
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${campaignStatusStyle(status)}`}>
      {CAMPAIGN_STATUS_LABELS[status]}
    </span>
  );
}

// ------------------------------------------------------------------ create

function CreateCampaignForm({
  channels, templates, contacts, canManage, onCancel, onCreated,
}: {
  channels: ChannelOption[];
  templates: SelectableTemplate[];
  contacts: ConsentContact[] | null;
  canManage: boolean;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const sendable = channels.filter((channel) => channel.enabled);
  const defaultChannel = sendable.find((channel) => channel.isDefault) ?? sendable[0];
  const [name, setName] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState(defaultChannel?.phoneNumberId ?? "");
  const [templateKey, setTemplateKey] = useState(templates[0]?.key ?? "");
  const [values, setValues] = useState<string[]>([]);
  const [audience, setAudience] = useState<"all" | "tag">("all");
  const [tag, setTag] = useState("");
  // The campaign id is fixed per attempt so a retried POST cannot create a second campaign.
  const [campaignId] = useState(() => newCampaignId());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = templates.find((item) => item.key === templateKey) ?? null;
  const variableCount = template?.bodyVariables ?? 0;
  const variables = Array.from({ length: variableCount }, (_, index) => values[index] ?? "");
  const audienceTag = audience === "tag" && tag ? tag : null;
  const tags = useMemo(() => (contacts ? tagsFromContacts(contacts) : []), [contacts]);
  const audienceCount = contacts ? audienceFromContacts(contacts, audienceTag) : null;
  const problem = variableProblem(variables, variableCount);

  const setVariable = (index: number, value: string) => {
    setValues((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  };

  const submitDisabled = !canManage || submitting || !name.trim() || !phoneNumberId || !template
    || problem !== null || (audienceCount !== null && audienceCount.optedIn === 0);

  const submit = async () => {
    if (!template) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          id: campaignId,
          name: name.trim(),
          phoneNumberId,
          templateName: template.name,
          templateLanguage: template.language,
          audienceTag,
          templateVariables: variables.map((value) => value.trim()),
        }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(errorFromBody(body, "The campaign could not be created."));
      onCreated(campaignId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The campaign could not be created.");
    } finally {
      setSubmitting(false);
    }
  };

  const sample = { name: "Asha", waId: "919900000000" };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">New campaign</h2>
        <button type="button" onClick={onCancel} className="text-sm text-gray-400 hover:text-white">Close</button>
      </div>

      {sendable.length === 0 && (
        <p className="text-sm text-amber-200">Connect and enable a WhatsApp number before creating a campaign.</p>
      )}
      {templates.length === 0 && (
        <p className="text-sm text-amber-200">
          No approved templates can be used for campaigns yet. <Link className="underline" href="/templates">Review templates</Link>.
        </p>
      )}

      <label className="block space-y-1">
        <span className="text-sm text-gray-300">Campaign name</span>
        <input
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
          placeholder="Diwali offer, May newsletter…"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-gray-300">Send from</span>
        <select
          value={phoneNumberId}
          onChange={(event) => setPhoneNumberId(event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
        >
          {sendable.map((channel) => (
            <option key={channel.phoneNumberId} value={channel.phoneNumberId}>
              {channel.channelName || channel.verifiedName} · {channel.displayPhoneNumber}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-gray-300">Approved template</span>
        <select
          value={templateKey}
          onChange={(event) => { setTemplateKey(event.target.value); setValues([]); }}
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
        >
          {templates.map((item) => (
            <option key={item.key} value={item.key}>{item.name} ({item.language})</option>
          ))}
        </select>
      </label>

      {template && variableCount > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">Template variables</p>
          {variables.map((value, index) => (
            <div key={index} className="space-y-1">
              <label className="block text-xs text-gray-400" htmlFor={`var-${index}`}>Variable {"{{" + (index + 1) + "}}"}</label>
              <div className="flex gap-2">
                <input
                  id={`var-${index}`}
                  value={value}
                  maxLength={500}
                  onChange={(event) => setVariable(index, event.target.value)}
                  className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                />
                {VARIABLE_HELPERS.map((helper) => (
                  <button
                    key={helper.token}
                    type="button"
                    onClick={() => setVariable(index, `${value}${helper.token}`)}
                    className="rounded-lg border border-white/10 px-2 text-xs text-gray-300 hover:border-white/30"
                    title={helper.label}
                  >
                    + {helper.token}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {template.bodyText && (
            <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-gray-200">
              <p className="text-xs text-gray-500 mb-1">Preview for {sample.name}</p>
              {previewBody(template.bodyText, variables, sample)}
            </div>
          )}
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm text-gray-300">Audience</legend>
        <label className="flex items-center gap-2 text-sm text-gray-200">
          <input type="radio" checked={audience === "all"} onChange={() => setAudience("all")} />
          All opted-in contacts
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-200">
          <input type="radio" checked={audience === "tag"} onChange={() => setAudience("tag")} />
          Contacts with a tag
        </label>
        {audience === "tag" && (
          <select
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            className="ml-6 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
          >
            <option value="">Choose a tag</option>
            {tags.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        )}
      </fieldset>

      <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-gray-200">
        {contacts === null && "Counting contacts…"}
        {audienceCount && (
          <>
            <p>{formatCount(audienceCount.contacts)} contact(s) in this audience</p>
            <p className={audienceCount.optedIn === 0 ? "text-amber-300" : "text-emerald-300"}>
              {formatCount(audienceCount.optedIn)} opted in and will receive the message
            </p>
            {audienceCount.optedIn === 0 && (
              <p className="text-amber-300 mt-1">Record consent in the Consent tab before creating this campaign.</p>
            )}
          </>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {!error && problem && variableCount > 0 && <p className="text-xs text-gray-400">{problem}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          disabled={submitDisabled}
          onClick={() => void submit()}
          className="rounded-lg bg-whatsapp px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          {submitting ? "Creating…" : "Create draft"}
        </button>
        <p className="self-center text-xs text-gray-400">A draft sends nothing. Start it from the campaign page.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ detail

function CampaignDetail({ campaignId, canManage, onChanged }: { campaignId: string; canManage: boolean; onChanged: () => void }) {
  const [data, setData] = useState<CampaignDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<CampaignAction | null>(null);
  const [confirming, setConfirming] = useState<"start" | "cancel" | null>(null);
  const [batch, setBatch] = useState<BatchSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, { cache: "no-store" });
      const body = await readJson(response);
      if (!response.ok) throw new Error(errorFromBody(body, "This campaign is unavailable right now."));
      setData((body as { data: CampaignDetailData }).data);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This campaign is unavailable right now.");
    }
  }, [campaignId]);

  useEffect(() => { void load(); }, [load]);

  const status = data?.campaign.status ?? null;
  useEffect(() => {
    if (!shouldPoll(status)) return;
    const timer = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [status, load]);

  const run = async (action: CampaignAction) => {
    setBusy(action);
    setNotice(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(errorFromBody(body, "The campaign action could not be completed."));
      if (action === "send_batch") {
        const result = (body as { data: { summary: BatchSummary } }).data;
        setBatch(result.summary);
      }
      setConfirming(null);
      await load();
      onChanged();
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "The campaign action could not be completed.");
    } finally {
      setBusy(null);
    }
  };

  if (error && !data) return <p role="alert" className="text-sm text-red-300">{error}</p>;
  if (!data) return <p className="text-sm text-gray-400">Loading campaign…</p>;

  const { campaign, problems } = data;
  const actions = actionsForStatus(campaign.status);
  const copy = confirming ? confirmationCopy(confirming, campaign) : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">{campaign.name}</h2>
          <p className="text-sm text-gray-400">
            Template {campaign.templateName} ({campaign.templateLanguage}) · {campaign.audienceTag ? `tag: ${campaign.audienceTag}` : "all opted-in contacts"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Created {formatDateTime(campaign.createdAt)}
            {campaign.startedAt && ` · Started ${formatDateTime(campaign.startedAt)}`}
            {campaign.completedAt && ` · Finished ${formatDateTime(campaign.completedAt)}`}
          </p>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      {campaign.lastError && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">{campaign.lastError}</p>
      )}

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {countRows(campaign.counts).map((row) => (
          <div key={row.key} className="rounded-lg border border-white/10 bg-black/30 p-3">
            <dt className="text-xs text-gray-400">{row.label}</dt>
            <dd className="text-lg font-semibold text-white">{formatCount(row.value)}</dd>
          </div>
        ))}
      </dl>

      {actions.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {actions.includes("start") && (
              <ActionButton label={campaign.status === "paused" ? "Resume" : "Start"} disabled={!canManage || busy !== null} onClick={() => setConfirming("start")} />
            )}
            {actions.includes("send_batch") && (
              <ActionButton label="Send next batch" disabled={!canManage || busy !== null} onClick={() => void run("send_batch")} busy={busy === "send_batch"} />
            )}
            {actions.includes("pause") && (
              <ActionButton label="Pause" disabled={!canManage || busy !== null} onClick={() => void run("pause")} busy={busy === "pause"} />
            )}
            {actions.includes("cancel") && (
              <ActionButton label="Cancel" tone="danger" disabled={!canManage || busy !== null} onClick={() => setConfirming("cancel")} />
            )}
          </div>
          {campaign.status === "sending" && (
            <p className="text-xs text-gray-400">
              Status refreshes every 15 seconds. Sending also continues from the scheduled worker once that is enabled. Use Send next batch to send one batch now.
            </p>
          )}
          {!canManage && <p className="text-xs text-amber-200">Only owners and admins can change this campaign.</p>}
        </div>
      )}

      {copy && (
        <div role="dialog" aria-label={copy.title} className="rounded-xl border border-white/20 bg-black/40 p-4 space-y-3">
          <p className="font-semibold text-white">{copy.title}</p>
          <p className="text-sm text-gray-300">{copy.body}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run(confirming === "start" ? "start" : "cancel")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${confirming === "cancel" ? "bg-red-600" : "bg-whatsapp"}`}
            >
              {copy.confirmLabel}
            </button>
            <button type="button" onClick={() => setConfirming(null)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-200">
              Keep as is
            </button>
          </div>
        </div>
      )}

      {notice && <p role="alert" className="text-sm text-red-300">{notice}</p>}

      {batch && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="font-semibold text-emerald-100 mb-2">Last batch</p>
          <ul className="list-disc pl-5 text-sm text-emerald-50 space-y-1">
            {batchSummaryLines(batch).map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">Problems</h3>
        {problems.length === 0 && <p className="text-sm text-gray-400">No failed, uncertain or skipped recipients.</p>}
        {problems.length > 0 && (
          <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
            {problems.map((problem, index) => (
              <li key={`${problem.waId}-${index}`} className="p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white">{problem.contactName} <span className="text-gray-500">+{problem.waId}</span></span>
                  <span className="text-xs font-semibold text-gray-300">{problemLabel(problem)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{problemReason(problem)}</p>
              </li>
            ))}
          </ul>
        )}
        {problems.length >= 50 && <p className="text-xs text-gray-500">Showing the 50 most recent problems.</p>}
      </div>
    </div>
  );
}

function ActionButton({ label, onClick, disabled, busy, tone }: { label: string; onClick: () => void; disabled: boolean; busy?: boolean; tone?: "danger" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 ${
        tone === "danger" ? "border border-red-500/40 text-red-200 hover:bg-red-500/10" : "bg-whatsapp text-white hover:opacity-90"
      }`}
    >
      {busy ? "Working…" : label}
    </button>
  );
}

// ------------------------------------------------------------------ consent

function ConsentPanel({
  contacts, error, canManage, onChanged,
}: {
  contacts: ConsentContact[] | null;
  error: string | null;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [consent, setConsent] = useState<ConsentStatus | "none" | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const tags = useMemo(() => (contacts ? tagsFromContacts(contacts) : []), [contacts]);
  const visible = useMemo(
    () => (contacts ? filterConsentContacts(contacts, { query, tag, consent }) : []),
    [contacts, query, tag, consent]
  );

  const toggle = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async (status: ConsentStatus) => {
    const contactIds = [...selected];
    if (contactIds.length === 0) return;
    if (contactIds.length > CONSENT_BATCH_LIMIT) {
      setNotice(`Select up to ${formatCount(CONSENT_BATCH_LIMIT)} contacts at a time.`);
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/campaigns/consent", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ status, contactIds, confirmed: status === "opted_in" ? agreed : undefined }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(errorFromBody(body, "Consent could not be saved."));
      const updated = (body as { data: { updated: number } }).data.updated;
      setNotice(`${formatCount(updated)} contact(s) marked ${status === "opted_in" ? "opted in" : "opted out"}.`);
      setSelected(new Set());
      setAgreed(false);
      onChanged();
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Consent could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  if (error && !contacts) return <p role="alert" className="text-sm text-red-300">{error}</p>;
  if (!contacts) return <p className="text-sm text-gray-400">Loading contacts…</p>;

  const optedIn = contacts.filter((contact) => contact.consent === "opted_in").length;

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-300">
        {formatCount(optedIn)} of {formatCount(contacts.length)} contacts are opted in to marketing messages. Only opted-in contacts receive campaigns.
        The list shows up to 5,000 contacts.
      </p>

      <div className="flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or phone"
          className="flex-1 min-w-48 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
        />
        <select value={tag ?? ""} onChange={(event) => setTag(event.target.value || null)} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white">
          <option value="">All tags</option>
          {tags.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={consent} onChange={(event) => setConsent(event.target.value as typeof consent)} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white">
          <option value="all">Any consent</option>
          <option value="opted_in">Opted in</option>
          <option value="opted_out">Opted out</option>
          <option value="none">No consent recorded</option>
        </select>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <p className="text-sm text-gray-200">{formatCount(selected.size)} selected</p>
        <label className="flex items-start gap-2 text-sm text-gray-200">
          <input
            type="checkbox"
            checked={agreed}
            disabled={!canManage}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-1"
          />
          <span>I confirm the selected contacts agreed to receive marketing messages from this business before they are opted in.</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canManage || saving || selected.size === 0 || !agreed}
            onClick={() => void save("opted_in")}
            className="rounded-lg bg-whatsapp px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Mark opted in
          </button>
          <button
            type="button"
            disabled={!canManage || saving || selected.size === 0}
            onClick={() => void save("opted_out")}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-200 disabled:opacity-40"
          >
            Mark opted out
          </button>
        </div>
        {notice && <p role="status" className="text-sm text-gray-200">{notice}</p>}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      </div>

      {visible.length === 0 && <p className="text-sm text-gray-400">No contacts match these filters.</p>}
      <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
        {visible.slice(0, 500).map((contact) => (
          <li key={contact.id} className="flex items-center gap-3 p-3">
            <input
              type="checkbox"
              aria-label={`Select ${contact.name}`}
              checked={selected.has(contact.id)}
              disabled={!canManage}
              onChange={() => toggle(contact.id)}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-white">{contact.name}</p>
              <p className="text-xs text-gray-400">+{contact.phoneNumber}{contact.tags.length > 0 && ` · ${contact.tags.join(", ")}`}</p>
            </div>
            <span className={`text-xs font-semibold ${contact.consent === "opted_in" ? "text-emerald-300" : contact.consent === "opted_out" ? "text-red-300" : "text-gray-400"}`}>
              {consentLabel(contact.consent)}
            </span>
          </li>
        ))}
      </ul>
      {visible.length > 500 && <p className="text-xs text-gray-500">Showing the first 500 matches. Narrow the filters to see more.</p>}
    </div>
  );
}

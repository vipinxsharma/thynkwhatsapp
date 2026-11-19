import type { BatchSummary } from "@/lib/campaigns/sender";
import type { Campaign, CampaignCounts, CampaignStatus, ConsentContact, ConsentStatus, RecipientProblem } from "@/lib/campaigns/store";
import { inspectTemplate, resolveVariable } from "@/lib/campaigns/template";

// Pure helpers for the campaigns screen. Kept free of React and fetch so they can be unit tested.

export const POLL_INTERVAL_MS = 15_000;
export const CONSENT_BATCH_LIMIT = 1000;

export type CampaignAction = "start" | "pause" | "cancel" | "send_batch";

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  sending: "Sending",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<CampaignStatus, string> = {
  draft: "bg-gray-500/10 text-gray-300 border-gray-500/20",
  sending: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  paused: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  completed: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  cancelled: "bg-red-500/10 text-red-300 border-red-500/20",
};

export function campaignStatusStyle(status: CampaignStatus): string {
  return STATUS_STYLES[status];
}

/** Owners and admins may start, pause, cancel, send batches and change consent. */
export function canManageCampaigns(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** Actions a campaign's status allows, before the role check. */
export function actionsForStatus(status: CampaignStatus): CampaignAction[] {
  switch (status) {
    case "draft":
      return ["start", "cancel"];
    case "sending":
      return ["send_batch", "pause", "cancel"];
    case "paused":
      return ["start", "cancel"];
    default:
      return [];
  }
}

export function roleLimitMessage(role: string | null | undefined): string | null {
  if (canManageCampaigns(role)) return null;
  return "Only workspace owners and admins can start, pause, cancel or send campaigns, or change consent. Your role can view them.";
}

/** The campaign list and detail poll only while a campaign is sending. */
export function shouldPoll(status: CampaignStatus | null | undefined): boolean {
  return status === "sending";
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN").format(Number.isFinite(value) ? value : 0);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function countRows(counts: CampaignCounts): Array<{ key: string; label: string; value: number }> {
  return [
    { key: "total", label: "Total", value: counts.total },
    { key: "sent", label: "Sent", value: counts.sent },
    { key: "delivered", label: "Delivered", value: counts.delivered },
    { key: "read", label: "Read", value: counts.read },
    { key: "failed", label: "Failed", value: counts.failed },
    { key: "uncertain", label: "Uncertain", value: counts.uncertain },
    { key: "skipped", label: "Skipped", value: counts.skipped },
  ];
}

/** Recipients that have not had an outcome yet and will be sent to (or skipped on cancel). */
export function remainingRecipients(counts: CampaignCounts): number {
  return counts.pending + counts.sending;
}

export function problemLabel(problem: Pick<RecipientProblem, "status">): string {
  switch (problem.status) {
    case "failed":
      return "Failed";
    case "uncertain":
      return "Uncertain";
    case "skipped":
      return "Skipped";
    default:
      return problem.status;
  }
}

export function problemReason(problem: Pick<RecipientProblem, "status" | "error">): string {
  if (problem.error && problem.error.trim()) return problem.error.trim();
  if (problem.status === "uncertain") return "The send was interrupted before its outcome was recorded. It is not retried automatically.";
  if (problem.status === "failed") return "WhatsApp did not accept this message.";
  if (problem.status === "skipped") return "This contact was skipped.";
  return "No reason recorded.";
}

export interface ConfirmationCopy {
  title: string;
  body: string;
  confirmLabel: string;
}

/** Plain-language copy for the confirm step before Start or Cancel. */
export function confirmationCopy(action: "start" | "cancel", campaign: Pick<Campaign, "name" | "templateName" | "phoneNumberId" | "counts">): ConfirmationCopy {
  const remaining = formatCount(remainingRecipients(campaign.counts));
  if (action === "start") {
    return {
      title: `Start "${campaign.name}"?`,
      body: `This sends the template "${campaign.templateName}" from number ${campaign.phoneNumberId} to ${remaining} opted-in contact(s). Sending happens in batches and keeps going until every recipient has an outcome, or until you pause it.`,
      confirmLabel: "Start sending",
    };
  }
  return {
    title: `Cancel "${campaign.name}"?`,
    body: `${remaining} recipient(s) not yet sent will be skipped and nothing else will go out. Messages already sent cannot be recalled. A cancelled campaign cannot be restarted.`,
    confirmLabel: "Cancel campaign",
  };
}

export interface AudienceSummary {
  contacts: number;
  optedIn: number;
}

export function audienceFromContacts(contacts: ConsentContact[], tag: string | null): AudienceSummary {
  const members = tag ? contacts.filter((contact) => contact.tags.includes(tag)) : contacts;
  return {
    contacts: members.length,
    optedIn: members.filter((contact) => contact.consent === "opted_in").length,
  };
}

export function tagsFromContacts(contacts: ConsentContact[]): string[] {
  const tags = new Set<string>();
  for (const contact of contacts) for (const tag of contact.tags) if (tag.trim()) tags.add(tag.trim());
  return [...tags].sort((a, b) => a.localeCompare(b));
}

export function filterConsentContacts(
  contacts: ConsentContact[],
  filter: { query: string; tag: string | null; consent: ConsentStatus | "none" | "all" }
): ConsentContact[] {
  const query = filter.query.trim().toLowerCase();
  return contacts.filter((contact) => {
    if (query && !contact.name.toLowerCase().includes(query) && !contact.phoneNumber.includes(query)) return false;
    if (filter.tag && !contact.tags.includes(filter.tag)) return false;
    if (filter.consent === "all") return true;
    if (filter.consent === "none") return contact.consent === null;
    return contact.consent === filter.consent;
  });
}

export function consentLabel(consent: ConsentStatus | null): string {
  if (consent === "opted_in") return "Opted in";
  if (consent === "opted_out") return "Opted out";
  return "No consent recorded";
}

export interface SelectableTemplate {
  key: string;
  name: string;
  language: string;
  category: string;
  bodyVariables: number;
  bodyText: string;
}

type TemplateLike = {
  name: string;
  language: string;
  status?: string;
  category?: string;
  components?: unknown;
};

/** Only approved templates the campaign sender can fill are offered. */
export function selectableTemplates(templates: TemplateLike[]): SelectableTemplate[] {
  const options: SelectableTemplate[] = [];
  for (const template of templates) {
    const inspection = inspectTemplate(template);
    if (!inspection.ok) continue;
    const components = Array.isArray(template.components) ? (template.components as Array<{ type?: string; text?: string }>) : [];
    const body = components.find((component) => String(component.type || "").toUpperCase() === "BODY");
    options.push({
      key: `${template.name}|${template.language}`,
      name: template.name,
      language: template.language,
      category: String(template.category || inspection.category || ""),
      bodyVariables: inspection.bodyVariables,
      bodyText: body?.text || "",
    });
  }
  return options.sort((a, b) => a.name.localeCompare(b.name));
}

/** Preview of the body with the variable values filled in for a sample contact. */
export function previewBody(bodyText: string, values: string[], sample: { name: string; waId: string }): string {
  return bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, index: string) => {
    const value = values[Number(index) - 1];
    return value === undefined ? match : resolveVariable(value, sample);
  });
}

export const VARIABLE_HELPERS = [
  { token: "{{name}}", label: "Contact name" },
  { token: "{{phone}}", label: "Phone number" },
] as const;

/** Variables must be non-empty and at most 500 characters, as the create API requires. */
export function variableProblem(values: string[], expected: number): string | null {
  if (values.length !== expected) return `This template needs ${expected} variable value(s)`;
  if (values.some((value) => value.trim().length === 0)) return "Every template variable needs a value";
  if (values.some((value) => value.length > 500)) return "Each variable value must be 500 characters or fewer";
  return null;
}

export function batchSummaryLines(summary: BatchSummary): string[] {
  const lines = [
    `${formatCount(summary.claimed)} recipient(s) claimed in this batch`,
    `${formatCount(summary.sent)} sent`,
    `${formatCount(summary.failed)} failed`,
    `${formatCount(summary.skipped)} skipped`,
    `${formatCount(summary.uncertain)} uncertain`,
  ];
  if (summary.released > 0) lines.push(`${formatCount(summary.released)} released back to pending`);
  if (summary.pausedReason) lines.push(`Campaign paused: ${summary.pausedReason}`);
  return lines;
}

/** Builds a random RFC 4122 version 4 UUID from 16 random bytes. */
export function uuidV4(bytes: Uint8Array): string {
  if (bytes.length !== 16) throw new Error("uuidV4 needs exactly 16 random bytes");
  const b = Uint8Array.from(bytes);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newCampaignId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  return uuidV4(bytes);
}

export function errorFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  return fallback;
}

# 247marketing tenant portal vs Xeccel tenant app: gap analysis

Date: 2026-11-19. Xeccel side read from `origin/main` at `40f7ad3`.

## How this was done

- **Portal:** every sidebar item and sub-page of the 247marketing tenant portal was opened read-only in a signed-in account. Nothing was created, edited, sent, synced or deleted. Create forms were opened to read their fields but never submitted.
- **Xeccel:** navigation in `components/layout/DashboardShell.tsx`, pages under `app/(dashboard)/`, routes under `app/api/`, and migrations `0001`–`0014`.
- **Not inspected:** the inside of the portal's visual flow builder and its WhatsApp Flow form builder. Their "create" links may create a record on click, so only the list pages were read. Sizes for those two rows are estimates from the list pages alone.
- **Excluded from "missing":** bulk campaign sending with consent tracking and delivery status. It is a placeholder on `main` but is being built on `feat/campaign-sending`, so it is treated as in progress here.

This document describes features only. Build them in Xeccel's own design and wording; no portal text, branding or images should be reused.

## Portal map

| Portal area | What it does |
|---|---|
| Home / Dashboard | Shortcut buttons (start campaign, add contact, add auto response, add template). Count cards: campaigns with read rate, templates approved, contacts with new-this-month, open chats with resolved count, reply bots with messages sent, quality rating. Connected business profile card. Charts: campaign conversion funnel, top campaigns by read rate, message status overview, daily message volume. |
| Chat | Conversation list with search, All / Mine / New tabs with counts, unread markers, export chats. Thread with a "hours left to reply" badge. Composer tabs: reply, documents, quick replies; emoji picker. Three side panels: **Contact** (label, assigned agent, contact details, subscribed state, chat status with reopen, language), **AI** (auto-translate, rewrite a draft in a chosen tone, generate chat summary, ask a question about the conversation), **Notes** (internal notes). |
| Campaigns | List with filters. New campaign: name, template, audience (all contacts or a group), optional schedule. |
| Lead list | Contacts who tapped a campaign button. Filters: name, phone, campaign, button, date range. Download report. Board view with user-defined stages. |
| AI Flows | List of automation flows with status and last-updated; create flow (visual builder, not inspected). |
| Flow history | Per-contact flow runs: contact, flow, status, date. |
| Contacts → list | Table with name, phone, email, subscribed / opted-out status, groups. Column filters, page size up to 500, bulk select, export. Add contact form: avatar, name, country code + phone, email, groups. |
| Contacts → fields | Defined custom fields with a name and type. |
| Contacts → groups | Named groups with a contact count. |
| Contacts → import | Standard CSV import (fixed columns, extra columns become custom fields, target group, sample file) and a column-mapping import for arbitrary CSVs. |
| Templates | Table: name, status, category, preview, language; sort, filter, delete, sync from Meta, link out to WhatsApp Manager. Builder: standard or carousel; marketing / utility / authentication; about 70 languages; header none / text / image / video / PDF; body with bold, italic, code and variables; AI body generation; deliverability check; footer; several quick-reply buttons; call-to-action buttons (website ×2, phone, copy offer code, dynamic URL, WhatsApp Flow); live preview. |
| Settings → Agents | List agents; add agent with name, email and password. |
| Settings → WhatsApp Flows | Meta form flows: name, Meta flow id, status, categories, endpoint URL; sync from Meta; create. |
| Settings → Score checker | Paste template text and get a 0–100 deliverability score against policy, spam wording, promotional tone and variable formatting, with sample presets and guidance. |
| Settings → Triggers (bots) | Auto-responses: name, reply text with contact-field placeholders, reply type, trigger keyword. Two kinds: plain message bot and template-based bot. On/off status. |
| Settings → API info | Base URL, bearer token with copy, code samples in four languages, an OpenAPI reference grouped into messaging, agent/mobile and connect APIs, Postman link. |
| Settings → API campaigns | Named campaigns with an id that outside systems trigger through the API. |
| Settings → Cloud API setup | Embedded-login connection status and reconnect, five-step onboarding checklist with progress, business profile card with edit profile, `wa.me` link, link to live chat. |
| Apps | One settings form with tabs: **webhooks** (forward inbound WhatsApp data to a URL; post captured leads to a URL, with a sample payload), **chat settings** (unsubscribe keyword, agent-handover keyword and message, blocked numbers), **bot settings** (holding message when a reply will be slow), **Meta credentials** (manual app id, secret, phone number id, WABA id, permanent token), **links** (a links tab in chat), **agents** (enable agents; agents see only chats assigned to them), **AI key** (bring-your-own model-router key), **translation** (translate inbound messages into a chosen language). |
| Advance analytics | Message log: recipient, message, status (sent / delivered / read / failed), sent time, failure reason, message id with copy; filters; paginated. |
| Header | Language switcher (two languages), account menu linking to a separate billing/account site, organisation switcher, upgrade-plan link. |

## Xeccel today (summary)

| Xeccel area | State on `main` |
|---|---|
| Overview `/dashboard` | Partial: setup checklist, 24h-window counts, connected senders, recent conversations. No charts. |
| Team inbox `/inbox` | Working: live thread, text and template send, 24h-window enforcement, status (open / pending / closed), tags, contact sidebar. No assignment, notes, quick replies or export. Media send returns 501 on the Postgres path. |
| Contacts `/contacts` | Working: CRUD, tag filter, CSV import, CSV export, free-form custom attributes. List capped at 200. No groups, field definitions or opt-out state. |
| CRM `/crm` | Working as a choice of partner CRM only. |
| Automations `/automations` | Working for keyword routing (add tags, set status) with a simulator and run history. Does not send replies. |
| Campaigns `/campaigns` | Placeholder on `main`; in progress on `feat/campaign-sending`. |
| Templates `/templates` | List is a live read from Meta. Builder is partial: 4 languages, text or image header (image sent without a sample), one button, no variable examples. No delete, carousel or stored status. |
| Analytics `/analytics` | Partial: message counts for 7 / 30 / 90 days. No charts, message log or export. |
| Channels `/settings/waba` | Working: Embedded Signup, rename, default sender, status refresh, quality rating. |
| Team `/settings/team` | Partial: email invites with roles; no role change or removal. |
| Billing `/billing` | Working: plan checkout with Cashfree. Not linked from the sidebar. |
| Support `/support` | Working: cases, email, AI review. The portal has no equivalent. |
| AI Agents, Integrations, Commerce & Ads, SMS | Placeholder pages ("Planned" / "Phase 2"). |
| Platform admin | Read-only workspace list. |

## Gap table

Status key: **built** (parity or better), **partial**, **placeholder** (page exists, feature does not), **missing**. Size: small ≈ up to 2 days, medium ≈ 3–6 days, large ≈ 1–3 weeks.

| # | Portal section | Xeccel equivalent | Status | What would need building | Size |
|---|---|---|---|---|---|
| 1 | Chat: assignment, Mine / New tabs, agents see only assigned chats | `/inbox` | missing | Assignee column on conversations, assign control in the sidebar, list filters (all / mine / unassigned), workspace setting to restrict agents to their own chats. | medium |
| 2 | Chat: internal notes | `/inbox` | missing | Notes table, notes panel, audit entry. | small |
| 3 | Chat: quick replies in the composer | `/inbox` | missing | Saved-reply table with placeholders, management screen, picker in the composer. | small |
| 4 | Chat: documents and media send | `/inbox` (URL-only modal; API returns 501) | partial | File upload to storage, Meta media upload, image / video / document send on the Postgres path, inbound media display. | medium |
| 5 | Chat: export chats | — | missing | Export of conversations or a single thread to CSV. | small |
| 6 | Chat: AI panel (translate, tone rewrite, summary, ask) | `/ai-agents` placeholder; AI exists only for support cases | missing | Reuse the support AI client for draft rewrite, thread summary and a question box; optional inbound translation setting. | medium |
| 7 | Triggers / reply bots (message and template based) | `/automations` routes only | partial | Add a "send reply" action (text inside the 24h window, template outside it) to the existing rules, with placeholders and loop protection. | medium |
| 8 | Chat settings: unsubscribe keyword, handover keyword and message, blocked numbers, holding message | — | missing | Workspace messaging settings; webhook handling to mark opt-out, stop bots on handover, drop blocked senders. Opt-out must tie into the consent model from `feat/campaign-sending`. | medium |
| 9 | Contacts: groups | tags only | missing | Groups and membership tables, group management page, group filter, group as campaign audience and import target. | medium |
| 10 | Contacts: field definitions | free-form attributes | partial | Field-definition table (name, type), settings page, typed inputs on the contact form, use in placeholders. | small |
| 11 | Contacts: subscribed / opted-out status, column filters, large lists | 200-row cap, no consent column in the list | partial | Real pagination and server-side filters on a contacts query; show and filter consent state. | medium |
| 12 | Contacts: column-mapping import | fixed-format CSV import | partial | Mapping step in the import modal, extra columns into custom fields, import into a group. | small |
| 13 | Templates: full builder | `/templates/new` | partial | Multiple buttons (quick reply, URL, dynamic URL, phone, copy code), video and document headers with sample upload, variable examples, full language list, authentication structure, carousel. | large (medium without carousel) |
| 14 | Templates: sync, stored status, delete | live read only | partial | Persist templates locally, store status from the webhook that is currently only logged, sync button, delete. | medium |
| 15 | Template score checker and AI body generation | — | missing | Rule-based scorer for a pasted body, plus an AI draft button in the builder. | small |
| 16 | Lead list and stage board | — | missing | Capture template-button taps from the webhook against the campaign, lead table with filters and export, board with editable stages. Depends on campaigns landing. | medium |
| 17 | Campaigns: scheduling, group audience | in progress on `feat/campaign-sending` | in progress | Check after merge that scheduling and group audiences are covered; add if not. | small |
| 18 | API info: token, send API, docs | `/integrations` placeholder | placeholder | Hashed API keys per workspace, public send-message / contacts / templates endpoints with rate limits, key management page, reference docs. | large |
| 19 | API campaigns | — | missing | Named API-triggered campaigns that reuse the campaign sender. Depends on rows 17 and 18. | medium |
| 20 | Webhooks: forward inbound events, post leads | `/integrations` placeholder | placeholder | Per-workspace endpoint URLs with signing secret, delivery queue with retries, delivery log. | medium |
| 21 | AI Flows builder and flow history | — | missing | Flow model, visual editor (message, question, condition, action, handover nodes), runtime in the webhook, per-contact run log. | large |
| 22 | WhatsApp Flows (Meta forms) | — | missing | Create and sync flows through the Graph API, form builder, flow button in templates, store submissions against the contact. | large |
| 23 | Dashboard cards and charts | `/dashboard`, `/analytics` | partial | Count cards (templates, contacts, open chats, quality) and four charts: campaign funnel, top campaigns, status mix, daily volume. Campaign charts depend on row 17. | medium |
| 24 | Message log ("Advance analytics") | counts only | missing | Paginated outbound-message table with status, failure reason and message id, filters, CSV export. Data already exists in `app_inbox_messages`. | small |
| 25 | Business profile edit, `wa.me` link | — | missing | Read and update the WhatsApp business profile (about, description, address, email, website, picture) from Channels; show the chat link and a QR code. | small |
| 26 | Onboarding checklist with progress | `/dashboard` checklist, `/getting-started` | partial | Progress bar and step state driven by real data. | small |
| 27 | Agents | `/settings/team` | built (stronger: invites, four roles) | Add role change and member removal. | small |
| 28 | Cloud API connection | `/settings/waba` | built | — | — |
| 29 | Manual Meta credentials | — | not recommended | Embedded Signup replaces this; pasting app secrets is a security step backwards. | — |
| 30 | Bring-your-own AI key | platform-level AI key | not recommended for now | Only worth it if AI cost per tenant becomes an issue. | small |
| 31 | Interface language switcher | — | missing | i18n framework and translations (Hindi first). Low value until the app is stable. | large |
| 32 | Plans and upgrade | `/billing` | built | Add a Billing link to the sidebar and an invoices list. | small |

## Suggested build order

Ordered by what a paying tenant hits first in daily use, then by dependency.

1. **Inbox agent tools** (rows 1, 2, 3, 5): assignment, Mine / Unassigned tabs, notes, quick replies, export. One migration, all inside the inbox, no overlap with the campaign branch.
2. **Media and document sending** (row 4). The 501 on the live path is the most visible functional hole in the inbox.
3. **Auto-reply bots and chat settings** (rows 7, 8). Extends the existing automations engine. Touches the Meta webhook route, so start after `feat/campaign-sending` merges.
4. **Contact groups, field definitions, pagination, mapped import** (rows 9–12). Campaigns need groups as an audience; coordinate the audience picker with the campaign branch.
5. **Templates: stored status, sync, delete, fuller builder** (rows 14, 13 without carousel, 15). Fixes the image-header and variable-example defects that will cause Meta rejections today.
6. **Message log and dashboard charts** (rows 24, 23).
7. **Lead list and board** (row 16), after campaigns merge.
8. **Developer API, webhooks, API campaigns** (rows 18, 20, 19).
9. **Business profile edit, onboarding progress, team role edits, billing link** (rows 25, 26, 27, 32): small items that can fill gaps between larger ones.
10. **AI chat panel** (row 6).
11. **Flow builder** (row 21), then **WhatsApp Flows** (row 22) and **carousel templates**.
12. Language switcher (row 31) last.

## Dependencies and cautions

- Rows 7, 8, 16 and 14 change `app/api/webhooks/meta/route.ts`, which `feat/campaign-sending` also changes. Do them after that branch merges, and number new migrations from `0016`.
- Opt-out (row 8) and the contact consent column (row 11) must use the consent model introduced by the campaign branch rather than a second one.
- Rows 16, 17, 19 and the campaign charts in row 23 cannot be finished until campaign sending is on `main`.
- Rows 21 and 22 were sized without seeing the portal's builders.

# Xeccel brand and WATI workflow review — 15 October 2026

## Scope and evidence

This review uses the repository's WATI screen benchmark observed on 14 October, the implementation on main after PR #31, and WATI's current official multiple-number guide. It does not establish that every feature is available on the user's WATI plan. No WATI workspace was modified.

No separate approved Xeccel brand manual or complete WATI screenshot bundle was resolved in the available references. The visual baseline is the established Xeccel code and logo: Poppins; navy #142142 / #0b132a; orange #f38b26; warm cream #fefaf2; light and dark themes; the existing Xeccel / powered-by-thynkWISE logo. This is implementation alignment, not certification against an unseen manual.

## Visual findings and changes

| Area | Finding | Change |
| --- | --- | --- |
| App navigation | Desktop-only 256px sidebar consumed phone screens | Mobile menu and dynamic viewport layout; navigation closes after selecting a section |
| Navigation language | HSM / CRM / Build next exposed technical language | Team inbox, Message templates, Campaigns, and explicit planned-section grouping |
| Inbox shell | Always dark, excluded from the light palette | Conversation list, contact panel, input, header, and modals use shared theme surfaces |
| Message canvas | WhatsApp message bubbles have channel-specific meaning | Preserve native message-canvas colors while surrounding workspace follows Xeccel branding |
| Inbox on phones | Three fixed columns could not fit | Conversation list → selected thread → back action; contact details can be opened separately |
| Keyboard access | Conversation rows were pointer-only divs | Native buttons with selection labels; labeled search and filter state |
| Orange text | Bright orange small text lacked light-background contrast | Add darker orange text token #9b4804; dark mode uses #ffb366; retain orange CTA fills |
| Semantic states | Pale amber / green text became hard to read in light mode | Darker semantic text and light alert backgrounds outside the message canvas |
| Sender identity | Missing sender details displayed a sample number / GREEN quality | Display Not recorded when provider information is absent |
| Automation copy | UI described discarded implementation history | State the customer-facing limitation and offer a requirements/support next step |

## Screen and feature coverage

Presence of a route is not functional parity. Foundation means code exists; production behavior needs authentication, configuration, provider acceptance, and end-to-end verification.

| WATI screen / workflow | Xeccel route | Current verified code state | Remaining work |
| --- | --- | --- | --- |
| Team Inbox | /inbox | Tenant-scoped message reads, channel filtering, text/template submission path, older-message paging | Live send/receive test; cross-instance updates; server-side conversation search/paging; assignment/routing |
| Customer details | Inbox contact panel | Contact/context display; tag/status changes in this panel update client state only | Durable tag/status updates, ownership and assignment history |
| Contacts | /contacts | Create/edit/import API foundations | Persisted consent evidence, opt-out lifecycle, segmentation and bulk operations |
| Templates list | /templates | Template inventory and selection paths | Provider-verified per-channel inventory and approval lifecycle |
| Template creation | /templates/new | Template builder and submission path | Verify language, variables, media, categories and Meta review outcomes end to end |
| Campaign creation and audience | /campaigns | Guidance page; broadcast endpoint refuses dispatch in every environment | Consent-aware audiences, approved templates, scheduling, idempotent jobs, billing and delivery receipts |
| Scheduled campaigns / campaign reports | No dedicated working screens | Not implemented | Job lifecycle, retries, cancellation and event-backed reports |
| Automation rules / keywords | /automations | Informational customer page; production rule API disabled | Durable rules, channel scopes, event evaluation, logs and controls |
| Chatbots / sequences / drip / routing / WhatsApp Flows | No dedicated working screens | Not implemented | Separate builders, validation, versioning, testing, publish controls and runtime |
| AI Agents / Astra equivalent | /ai-agents | Capability map; authenticated support-case AI is separate | Agent instructions, knowledge management, evaluation, channel assignment and human handoff |
| Channel inventory / add number / rename / default | /settings/waba | Multi-number schema, ownership checks, inventory, rename/default APIs | Provider setup and live verification; resumable onboarding; channel-specific team permissions |
| Team / users | /settings/team | Invitations and membership foundations | Per-channel grants, richer team organization and verified invitation delivery |
| Account / billing | /login and internal entitlement endpoint | Signup/session code; subscription gate exists | Production authentication configuration; customer account controls; checkout/reconciliation and billing screens |
| Inbox analytics | /analytics | Recorded-message counts and date ranges | Per-channel / agent / team breakdowns and response-time metrics |
| Sales / calls / chatbot / operator analytics | No dedicated working screens | Not implemented | Source events and metrics for each product before reporting |
| API / webhooks / integrations | /integrations | Roadmap page; internal APIs and inbound provider webhooks exist | Customer credentials, documentation, signing, retries, delivery logs and connector configuration |
| Catalog / shopping | /growth | Roadmap page | Owned catalog connection, product sync and order lifecycle |
| Click-to-WhatsApp ads / attribution | /growth | Roadmap page | Opt-in ad-account connection, source capture and verified attribution |
| Support | /support | Tenant-scoped case and AI-review foundations | Production auth, email delivery, AI provider configuration, resolution and handoff verification |
| SMS gateway | /sms | Phase-two information and DLT draft storage | Provider selection, approved sender/templates, consent, dispatch, receipts and billing |

## Customer journeys

New visitor → Get started → account setup → Channels → contacts/templates → messaging activation → Team inbox → Support/Analytics.

Returning user → Sign in → workspace selection → inbox/contacts/templates. Password recovery and team invitations are separate entry points. Workspace routes remain authenticated.

A connected-channel record is not proof of a successful send or receive. A saved subscription schema is not a payment integration. No messaging, billing, or tenant-isolation gates were removed for this design pass.

## Release and verification limits

- Production database migrations 0008–0010 were separately tested on a Neon branch and applied; required tables verified.
- Production auth endpoint and durable-storage setting were saved. Three secret values remain pending owner entry; Vercel MCP continues to return 403 for environment-variable access.
- The setup guide is public; authenticated production screens cannot yet be verified with a customer account.
- Local browser preview is blocked by the host's port-binding restriction. Compile/type checks and existing automated tests cover the code; static visual review and live public-page checks supplement them.
- WATI-level navigation coverage is substantially ahead of working feature parity. Full parity requires product implementation, not a design-only release.

## References

- Repository benchmark: docs/product/wati-benchmark-sms-roadmap.md
- WATI official multi-number guide, checked 15 October: https://support.wati.io/en/articles/11561205-manage-multiple-whatsapp-numbers-in-a-single-wati-account
- WATI AI product: https://www.wati.io/products/astra/

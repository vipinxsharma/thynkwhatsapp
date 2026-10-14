# Xeccel section benchmark and SMS Phase 2

Observed read-only in the user's WATI workspace on 14 October 2026. This is a product-navigation benchmark, not evidence that every WATI feature is enabled on that account or working in Xeccel. No WATI data or settings were changed.

| WATI area observed | Xeccel today | Product decision |
| --- | --- | --- |
| Campaigns, templates, scheduled campaigns | Templates exist; production broadcasts deliberately disabled | Keep the send gate until audience consent, durable scheduling, receipts and billing are proven |
| Team Inbox and Contacts | Inbox, contacts and team foundations exist | Deepen assignment, routing, filters and real unread counts; never show sample counts as live |
| Automations: rules, chatbots, sequences, flows, routing, drip | Automations page states inactive | Build durable tenant-scoped rules and audit before enabling any automatic reply |
| Astra AI agents | AI support case review only | Add a distinct AI Agents section; customer-facing bots require knowledge, safety, evaluation and handoff |
| Commerce catalog and ads | No active catalog or ad connection | Add Commerce & Ads roadmap section; do not claim attribution or checkout before verified events |
| Analytics: inbox, sales, calls, chatbot, operator | Recorded message usage only | Add specialized reports only when corresponding source events exist |
| Connectors: API, integrations, webhooks | Internal routes and Meta webhook exist | Add Integrations section; customer credentials and outbound customer webhooks are not yet available |
| Settings: channels, users, account | WABA and team settings exist | Preserve accurate provider-status labels and self-serve account controls |

## Phase 2: SMS gateway for India

SMS is a separate channel, not a fallback that can reuse WhatsApp consent or Meta credentials. TRAI describes registration as a Principal Entity, header assignment, content-template registration, and applicable consent-template/consumer-consent requirements before bulk commercial messages are sent. The PE ID, header, content-template ID and route must be checked before dispatch. See [TRAI's advice to senders](https://www.trai.gov.in/advice-to-senders) and the [TCCCPR framework](https://www.trai.gov.in/tcccpr).

The UX must distinguish two choices:

1. **DLT registration access provider**: the operator portal that registers the legal entity, headers and templates. Registration is not an Xeccel approval. Examples of official portals/documentation include [Airtel](https://www.airtel.in/business/commercial-communication/help), [Vi](https://www.vilpower.in/faq/) and [Jio](https://ucc-trai.jio.com/).
2. **Delivery route / registered telemarketer**: the authorized provider carrying SMS traffic. Select using supported categories, API and receipt capability, reliability, support, price and contractual terms. Do not assume it is the same organization as the DLT registrar.

Implementation sequence: legal-entity and PE record → operator/route evaluation → approved headers and templates → consent/preference evidence → safe rendering and pre-send validation → idempotent dispatch and receipts → per-workspace usage and billing. Until all gates are implemented and verified, the SMS section is informational and has no send or registration action.

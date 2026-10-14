# Xeccel WhatsApp Business Platform

[![Application CI](https://github.com/vipinxsharma/thynkwhatsapp/actions/workflows/ci.yml/badge.svg)](https://github.com/vipinxsharma/thynkwhatsapp/actions/workflows/ci.yml)

Xeccel is the customer-facing brand for this multi-tenant WhatsApp Business platform. The intended domain is **xeccel.com**. Domain routing, Meta app naming, and legal/business ownership are separate setup steps and are not implied by this code change.

---

## Architecture & Tech Stack

- **Frontend & Edge**: Next.js 16 (App Router, React Server Components), Tailwind CSS 4, TypeScript.
- **Backend CMS & RLS**: Strapi (Headless CMS) with Document Service tenant isolation middleware and atomic ingestion controller.
- **Identity & tenancy**: Neon Managed Better Auth with Lakebase Postgres workspace membership and audit tables.
- **APIs**: Meta WhatsApp Cloud API (`v21.0`), Meta Embedded Signup (Facebook JavaScript SDK).
- **Security**:
  - Signed server sessions with role checks and server-derived tenant context.
  - Tenant-partitioned local state and authenticated, tenant-filtered real-time events.
  - Webhook verification: HMAC-SHA256 signature validation with `crypto.timingSafeEqual`.
  - Token storage: AES-256-GCM symmetric encryption at rest for System User & WABA tokens.
  - WhatsApp 24-Hour Policy: Real-time customer service window tracker with automatic fallback to pre-approved HSM templates.

The self-service and AI support constraints are documented in
[`docs/architecture/self-service-ai-support.md`](docs/architecture/self-service-ai-support.md).

Live webhook ingestion requires `INBOX_STORAGE=postgres` and a tenant-scoped
`DATABASE_URL`. Development demo data is never used to acknowledge a production
Meta webhook. Live text and approved-template sends use an idempotency-keyed
outbound ledger; uncertain provider outcomes are not retried automatically.
Live media, interactive messages, and broadcasts remain disabled until their
own validated delivery paths exist.

---

## Project Structure

```
thynkwhatsapp/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx                     # Overview analytics & delivery metrics
│   │   ├── inbox/page.tsx               # Unified CRM Inbox (Server Component)
│   │   ├── templates/page.tsx           # Approved WhatsApp HSM Templates & Mobile Simulator
│   │   ├── settings/waba/page.tsx       # Meta Embedded Signup & Phone Number management
│   │   └── layout.tsx                   # Multi-tenant layout, sidebar & status badges
│   ├── api/
│   │   ├── webhooks/meta/route.ts       # Meta Webhook (Challenge GET & Inbound Event POST)
│   │   ├── meta/embedded-signup/route.ts# Meta OAuth code exchange & WABA token storage
│   │   └── whatsapp/messages/send/route.ts # Outbound message dispatch with 24h window validation
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── inbox/
│   │   ├── UnifiedInbox.tsx             # Real-time CRM chat orchestrator & test simulator
│   │   ├── ConversationList.tsx         # Search, filters (All, Unread, Expired)
│   │   ├── MessageThread.tsx            # WhatsApp message bubbles & delivery ticks
│   │   ├── MessageInput.tsx             # 24h window countdown & HSM template lock
│   │   ├── ContactDetailsSidebar.tsx    # CRM customer tags, custom attributes & status
│   │   └── TemplateSelectorModal.tsx    # HSM template picker & parameter config
│   └── meta/
│       └── EmbeddedSignupButton.tsx     # Facebook SDK OAuth Embedded Signup button
├── lib/
│   ├── meta/
│   │   ├── signature.ts                 # HMAC-SHA256 signature verifier
│   │   ├── encryption.ts                # AES-256-GCM token encryptor/decryptor
│   │   └── client.ts                    # Meta Cloud API Graph client
│   └── strapi/
│       ├── client.ts                    # Strapi data client with mock fallback
│       └── mock-data.ts                 # Initial demo conversations, contacts, templates
├── strapi/
│   └── src/
│       ├── api/                         # Strapi collection definitions (Tenant, WABA, Phone, Contact, Message, Template)
│       ├── middlewares/
│       │   └── tenant-isolation.ts      # Multi-tenant Row-Level Security
│       └── api/whatsapp/controllers/
│           └── whatsapp.ts              # Atomic message & status ingestion
└── tests/
    └── webhook.test.ts                  # Vitest suite for cryptographic validation
```

---

## Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and set your credentials:
```bash
cp .env.example .env.local
```

Generate unique secrets for `AUTH_SESSION_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, and
`ENCRYPTION_KEY`. The server intentionally fails closed when they are absent. Webhooks resolve
the workspace from the verified WABA ID stored during Embedded Signup; no client or global
environment value selects the tenant.

Self-service identity additionally requires a dedicated Neon project with Managed Better Auth,
`NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, and `DATABASE_URL`. Apply
the numbered SQL files in `db/migrations/` in order using the direct
`DATABASE_URL_UNPOOLED`; normal application queries use the pooled URL. Run
`db/verify_schema.sql` afterward. CI applies the same migrations to a disposable
PostgreSQL 17 database on every PR. Migration 0006 provides the durable inbox;
migration 0007 provides the outbound request ledger; migration 0008 stores one
unverified SMS/DLT readiness draft per workspace. The SMS page does not submit
registrations or send messages. Do not point this
application at an unrelated tenant DB.

Migration 0009 adds subscription state and feature grants. Production outbound
sends require a current workspace subscription and explicit `whatsapp_send`
grant, but no payment activation writer exists yet. See the
[production-readiness checklist](docs/operations/production-readiness.md) before
considering a release.

Migration 0010 adds a separate record for each WhatsApp number, backfills existing
connections, and stores one default sender per workspace. Apply and verify this
migration before deploying channel-management code. Settings → WhatsApp channels
can name and add a number through Meta Embedded Signup, rename it locally, select a default,
and refresh its Meta phone inventory and quality fields. A Meta inventory match is
not proof of registration, display-name approval, webhook delivery, or successful
messaging. Existing conversations retain their original sender number when the
default changes. Provider-side number release, ownership migration, and live
cutover are not automated.

The inbox loads only the selected conversation's latest 50 messages and pages
older history with a tenant-scoped cursor. See the [data-scale plan](docs/architecture/saas-data-scale.md)
for the remaining conversation-paging, worker, retention, and recovery gates.

Meta Embedded Signup exchanges the code only after durable storage is configured, verifies that
the phone number belongs to the selected WABA, subscribes the WABA to webhooks, encrypts the
access token, and stores the connection against the authenticated workspace.

The support center requires `db/migrations/0003_support_cases.sql`. In-product messages are
authenticated and tenant-scoped. Inbound email must be delivered to
`support+<workspace-slug>@<your-support-domain>` through `/api/webhooks/support-email`, with the
raw payload signed by `SUPPORT_EMAIL_WEBHOOK_SECRET`. AI and human email replies are placed in a
durable outbox; no external email is sent until a delivery provider is configured in a later gate.

AI case review additionally requires `db/migrations/0004_ai_support_resolution.sql` and
`OPENAI_API_KEY`. It uses the Responses API with strict structured output, redacts common secrets
and personal identifiers, retrieves only workspace-scoped knowledge, and records an auditable run.
Only grounded, high-confidence, low-risk guidance can auto-resolve a case; billing, security,
compliance, ownership, and account-restriction issues always escalate.

Workspace team onboarding requires `db/migrations/0005_workspace_invitations.sql`. Owners and
administrators can create 72-hour, email-bound invite links; only owners can grant the administrator
role. Raw invite tokens are returned once in the URL fragment and only their hashes are stored.
Acceptance activates membership, records an audit event, and switches the signed application
session into the invited workspace. Active membership and role are re-checked on every protected
request so removal or suspension does not wait for the session token to expire.

### 3. Run Automated Tests
Verify webhook cryptography and challenge tokens:
```bash
npm test
```

### 4. Start Next.js Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Meta Webhook Configuration

1. In the **Meta App Dashboard**, navigate to **WhatsApp > Configuration**.
2. Set **Callback URL** to:
   ```
   https://<your-domain-or-ngrok>/api/webhooks/meta
   ```
3. Set **Verify Token** to the same unique secret configured in
   `META_WEBHOOK_VERIFY_TOKEN`.
4. Subscribe to the webhook fields:
   - `messages`
   - `message_template_status_update`

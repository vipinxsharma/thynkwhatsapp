# thynkWISE WhatsApp Business Platform

Enterprise Multi-Tenant WhatsApp Business API & Unified CRM Inbox built for **thynkWISE** as a Meta Tech Provider.

---

## Architecture & Tech Stack

- **Frontend & Edge**: Next.js 15 (App Router, React Server Components), Tailwind CSS, TypeScript.
- **Backend CMS & RLS**: Strapi (Headless CMS) with Document Service tenant isolation middleware and atomic ingestion controller.
- **APIs**: Meta WhatsApp Cloud API (`v21.0`), Meta Embedded Signup (Facebook JavaScript SDK).
- **Security**:
  - Webhook verification: HMAC-SHA256 signature validation with `crypto.timingSafeEqual`.
  - Token storage: AES-256-GCM symmetric encryption at rest for System User & WABA tokens.
  - WhatsApp 24-Hour Policy: Real-time customer service window tracker with automatic fallback to pre-approved HSM templates.

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
3. Set **Verify Token** to:
   ```
   thynkwise_meta_verify_token_secure_2026
   ```
4. Subscribe to the webhook fields:
   - `messages`
   - `message_template_status_update`

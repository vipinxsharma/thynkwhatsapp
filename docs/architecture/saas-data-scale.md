# Xeccel SaaS data and channel scale plan

This is the target architecture, not a claim that every gate is live. Keep the current
Neon/PostgreSQL store and the authenticated `workspace_id` boundary. Do not create
one database per customer or point Xeccel at another product's database.

## Data ownership and request path

- One Xeccel workspace owns members, WABA connections, phone channels, contacts,
  conversations, templates, automations, campaigns, entitlements, and support cases.
  Every customer-facing read and write uses the server-derived workspace ID.
- A WABA holds encrypted provider credentials; a phone channel is a separate
  sender under that WABA. A conversation is bound to a contact **and** channel.
  Changing the default sender never silently moves existing history.
- Preserve provider IDs (`waba_id`, `phone_number_id`, WhatsApp message ID) as
  unique/idempotency keys. Store secrets only server-side and encrypted.
- The Next.js app uses a pooled `DATABASE_URL`; migrations use the direct
  `DATABASE_URL_UNPOOLED`. No per-request database creation or tenant schema.

## Scale controls in this PR

The inbox previously loaded up to 200 conversations × 500 messages during one
page request, with sequential database calls and an oldest-first truncation.
It now loads conversation summaries first and fetches only the selected thread.
Message history is a 50-item, newest-first keyset page (returned in display
order), scoped to workspace and conversation. The `(workspace_id,
conversation_id, timestamp DESC, id DESC)` index supports that access pattern.
The API checks that the conversation belongs to the authenticated workspace
before returning any page. Inbound webhook routing now looks up the contact
and sender directly through tenant-scoped unique keys, rather than scanning
the first 200 conversations. This removes the inbox's largest immediate query
and payload multiplier; it does **not** make the 200-conversation list a complete
inbox at large scale.

## Next capacity gates

1. Add keyset pagination and server-side search/filtering to conversation
   summaries; remove the current 200-row ceiling. Use `(last_message_at, id)`
   as a stable cursor and measure query plans with realistic tenant volumes.
2. Move webhook processing, AI replies, campaigns, email, and analytics to
   durable jobs with per-workspace/channel rate limits. Acknowledge Meta only
   after a verified event has been durably recorded; make retries idempotent.
3. Keep hot message rows and provider event receipts in PostgreSQL. Store media
   in private object storage with expiring access; define retention and deletion
   policy before increasing volume. Partition only after measured table size,
   write rate, and query plans justify operational cost.
4. Separate OLTP from reporting via incremental aggregates or an analytics
   pipeline when reports begin to affect message latency. Add read replicas only
   after read pressure and consistency requirements are measured.
5. Monitor p95/p99 inbox load, query time, database connections, storage growth,
   webhook lag, queue age, duplicate rate, and failed sends per workspace.
   Load-test tenant isolation and several high-volume tenants, not just totals.

## Release and recovery

Run migrations on a disposable PostgreSQL database in CI, then a Neon branch
of the intended Xeccel production database with representative data. Review
query plans, lock duration, and rollback before a separately approved
production migration. Backups/point-in-time recovery, a tested restore, and
defined RPO/RTO are release gates; a green build is not a restore test.
Do not enable campaign delivery, AI auto-replies, or paid activation until
their durable workers, receipts, opt-in/entitlement gates, and provider tests
are independently proven.

References: [Neon connection pooling](https://neon.com/docs/connect/connection-pooling),
[Neon branching workflow](https://neon.com/docs/get-started-with-neon/workflow-primer),
[Neon compute sizing](https://neon.com/docs/manage/endpoints/).

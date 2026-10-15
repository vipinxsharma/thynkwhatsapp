# Xeccel feature parity acceptance

Full parity is a product release goal. A navigation item, configuration form, passing build, or a deployed provider integration does not establish parity. Every row below needs an authenticated customer journey and tenant-isolation evidence. WATI remains a behavioral reference; its assets and implementation are not copied.

| Capability | Acceptance criteria | Current evidence / remaining work |
|---|---|---|
| Customer access | Signup, sign-in, recovery, invite acceptance, workspace switching and revoked-access denial on production | Implemented foundations; production secrets and customer-account testing pending |
| Team inbox | Receive and reply, media, approved templates, assignment, notes, labels, saved replies, reliable multi-instance refresh and channel restrictions | Text/template ledger and receipt foundations; this release adds persisted labels/status. Media, assignment, notes, saved replies and cross-instance refresh remain |
| Contacts | CRUD, import/export, segments, consent evidence, opt-out lifecycle, safe bulk operations | CRUD/import foundations; consent, export and full segmentation remain |
| Templates | Per-channel inventory, text/media variables, provider submission, approval/rejection updates and error recovery | Builder/API foundations; full provider acceptance testing remains |
| Campaigns | Consented audience snapshot, sender/template approval, scheduled dispatch, pause/cancel, durable jobs, quotas, entitlement checks, deduplicated sends and receipt-backed reports | Production dispatch remains disabled. Durable campaigns and provider verification remain |
| Routing automation | Workspace CRUD, channel scopes, bounded literal matching, deterministic priority, simulation, pause/delete, idempotent webhook actions and execution history | Implemented in migration 0011 and automated tests; requires configured auth/channel for production journey verification |
| Chatbots and journeys | Versioned visual flows, interactive branching, validation, testing, publish controls, human handoff, sequences/drip scheduler and WhatsApp Flows integration | Not implemented |
| AI agents | Instructions, grounded knowledge, evaluation, channel deployment, safety/escalation policies, handoff and usage/cost reporting | Support-case AI is separate; customer agent product is not implemented |
| Integrations and public API | Scoped revocable customer credentials, documented endpoints, signed webhooks, delivery/retry history, tested connectors | Provider inbound/internal APIs exist; customer integration product remains |
| Commerce and ads | Authorized catalog/ad-account connection, sync errors, product/order lifecycle, source capture and verified attribution | Not implemented |
| Analytics | Inbox/channel/agent/team response metrics plus campaign, bot, AI, sales and call outcomes derived from real events | Recorded message counts exist; other reports require source-event implementations |
| Channels and team | Multi-number lifecycle, per-channel grants, roles, verified invite delivery and safe disconnect/replacement | Channel and membership foundations; channel ACL and delivery/lifecycle verification remain |
| Account and billing | Account controls, verified checkout, signed provider events, idempotent reconciliation, invoices, cancellation and recovery | Entitlement gate exists. Checkout/reconciliation/customer billing remain |
| SMS (phase two) | Approved DLT sender/templates, separate consent, provider dispatch, receipts, quotas and billing | DLT draft storage only; not part of current WhatsApp release |

## Routing release verification

- Local automated suite: 88 passing tests, 4 environment-dependent skipped tests at implementation time.
- Production webpack build passes, including TypeScript checks.
- Migration 0011 applied successfully to the dedicated Neon validation branch.
- Real PostgreSQL assertions on that branch confirm merged tags, saved status, one committed execution for repeated message IDs, and no action under a different workspace ID.
- CI applies migration 0011 and runs `db/tests/automation_routing.sql` in an isolated rollback transaction.
- New API mutations require an active owner/admin session for rules or owner/admin/agent for inbox details, with the existing same-origin and membership checks.
- Rules perform internal tag/status actions only. They do not send messages or grant billing access. First matching enabled rule wins; lower priorities then rule ID define stable order. Messages older than 24 hours or over five minutes in the future are excluded.
- Production authenticated browser verification remains blocked until required server secrets are saved. Meta acceptance requires the dedicated application's credentials, verified WABA/number and permitted test recipients.

## External activation requirements

Vercel still needs the prepared production `DATABASE_URL`, `AUTH_SESSION_SECRET` and `NEON_AUTH_COOKIE_SECRET` values. Set credentials through the provider's secure configuration UI; do not put values in issues, commits or chat. The connected MCP account has returned 403 for project environment-variable access. Meta, email, AI and payment integrations also require their dedicated provider credentials and verification. Missing implementation work above is independent of those credentials and is not represented as complete.

# Xeccel production readiness

This is a release gate, not a claim that the WhatsApp SaaS is live. Code and
provider configuration must be verified separately. Changes to the application
reach production only through reviewed, green pull requests; do not run a direct
production deployment.

## Current subscription foundation

Migration `0009_subscription_entitlements.sql` creates workspace-scoped
subscription state and explicit feature grants. `GET /api/billing/entitlements`
exposes only the authenticated workspace's currently usable features. In
production, the WhatsApp text/template send endpoint rejects sends unless that
workspace has an active or trialing subscription, a current period, and an
explicit `whatsapp_send` grant. Database errors fail closed. No checkout,
Cashfree webhook, reconciliation writer, or customer-initiated activation is
implemented in this batch. Do not manually mark a workspace paid or enable a
grant from an unverified payment claim.

## Ordered release checks

1. Merge the reviewed PR only after CI, migration, and send-gate review pass.
2. Test all numbered migrations and `db/verify_schema.sql` against a disposable
   PostgreSQL database and a Neon test branch. Apply migration `0009` to the
   intended production database with the direct, unpooled connection only as a
   separately approved release step. Application queries use the pooled URL.
3. Confirm the Xeccel Vercel project's Production environment has the required
   server-side variables from `.env.example` for each enabled capability.
   Keep secrets out of Git, PR comments, and logs. Do not enable mock delivery
   or point Xeccel at another product's database, Meta app, or Cashfree MID.
4. Verify the production deployment is from the approved PR merge commit, then
   check authentication, tenant isolation, webhook signature validation, and
   that an unentitled workspace cannot send. A `READY` build alone is not proof.
5. Enable paid access only after the dedicated Xeccel Cashfree MID, signed
   provider events, idempotent reconciliation, and billing recovery have been
   implemented and tested in later PRs. Confirm Meta app/WABA acceptance and a
   real permitted send separately before describing messaging as live.

Email outbox delivery and production campaigns are also later gates. The
current production broadcast endpoint remains disabled; do not remove that
block until audience consent, approved templates, durable job/receipt handling,
rate limits, and campaign entitlements have independent test evidence.

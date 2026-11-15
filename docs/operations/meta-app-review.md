# Meta App Review preparation

This runbook describes the implemented reviewer journey and its prerequisites.
A completed dashboard form, green CI run, or stored WhatsApp connection does
not establish live delivery or permission approval. Keep the submission in
draft until the reviewer can repeat the journey shown in the recording.

## Scope and current configuration

Xeccel is the customer product. The dedicated Meta app is **thynkWISE Messaging
Cloud**, app ID `1850114962828877`; business ID `718550427356660`. Confirm these
identifiers in the provider dashboard before changing settings.

The 20 October 2026 read-only check found:

- Vercel project `xeccel`, team `team_rbqtUCX6w05XmGGE5ox8X9ho`, had Production
  keys `NEON_AUTH_BASE_URL` and `INBOX_STORAGE` only. Values were not inspected.
- `DATABASE_URL`, `AUTH_SESSION_SECRET`, and `NEON_AUTH_COOKIE_SECRET` were
  absent. The public login page showed that self-service access was unavailable.
- Dedicated Neon project `weathered-frog-38131874`
  (`thynkWISE-Messaging-Cloud`), branch `br-restless-base-aztg34mw` (`main`),
  database `neondb`, already had Better Auth email/password signup and both
  `https://xeccel.com` and `https://www.xeccel.com` as trusted origins.
- All 21 tables expected by `db/verify_schema.sql` were present, including
  subscription, channel and automation tables. The WABA uniqueness constraint
  and pending-invitation index were present. This is a schema observation,
  not a substitute for application and isolation tests.
- Aggregate checks found no workspaces, members, WABA connections, channels,
  subscriptions, entitlements or inbox messages on that branch.

Recheck these facts at release time. Production domains have also been attached
to the separate `thynkwhatsapp` Vercel project; configuration for `xeccel` does
not configure that other project. Confirm the exact hostname, project and
deployment used for review.

## Configure access before a reviewed release

`lib/auth/config.ts` shows the login form only when all four checks pass:

| Variable | Requirement |
| --- | --- |
| `NEON_AUTH_BASE_URL` | Nonempty URL for this project's intended Auth branch |
| `DATABASE_URL` | Nonempty pooled connection for this project's intended database |
| `AUTH_SESSION_SECRET` | Independent secret of at least 32 characters |
| `NEON_AUTH_COOKIE_SECRET` | Independent secret of at least 32 characters |

The repository does not define a runtime database role or grants. Do not assume
an owner credential for `DATABASE_URL`: select the intended role explicitly and
verify its required application permissions. Account bootstrap reads workspace
membership and inserts the workspace, member and audit records. Later protected
requests read active membership again; Neon Auth uses its separate service API.
No authentication rewrite is needed to resolve the three missing values above.

Use existing provider authentication and a secure secret-handling process.
Do not ask a reviewer to set environment variables. Do not put credentials in
this document, screenshots, PR comments, shell arguments, or test fixtures.

For an authorized operator, the installed Vercel CLI supports explicit
project-scoped commands. These examples assume the approved values already
exist in access-restricted files outside the repository; they do not generate
or obtain them:

```sh
vercel env ls production --project xeccel --scope team_rbqtUCX6w05XmGGE5ox8X9ho
vercel env add DATABASE_URL production --project xeccel --scope team_rbqtUCX6w05XmGGE5ox8X9ho --type secret < /secure/xeccel/database-url
vercel env add AUTH_SESSION_SECRET production --project xeccel --scope team_rbqtUCX6w05XmGGE5ox8X9ho --type secret < /secure/xeccel/application-session-secret
vercel env add NEON_AUTH_COOKIE_SECRET production --project xeccel --scope team_rbqtUCX6w05XmGGE5ox8X9ho --type secret < /secure/xeccel/neon-cookie-secret
```

Do not overwrite an existing variable without checking its target and owner.
Verify the existing Auth URL against the intended Neon branch. Keep Preview
credentials and databases separate from Production. Do not pull Production
secrets to a local checkout to diagnose the missing-key condition.

For the implemented Meta journey, also configure:

| Variable | Use / type |
| --- | --- |
| `NEXT_PUBLIC_META_APP_ID` | Dedicated app ID; public Config |
| `NEXT_PUBLIC_META_CONFIG_ID` | Embedded Signup configuration ID; public Config |
| `META_APP_SECRET` | Code exchange and webhook signature verification; Secret |
| `META_WEBHOOK_VERIFY_TOKEN` | Webhook challenge verification; Secret |
| `ENCRYPTION_KEY` | Stored WABA token encryption; Secret, at least 32 characters |
| `INBOX_STORAGE` | Must be `postgres` for durable production messaging |

The browser exposes both `NEXT_PUBLIC_` values. Never put a token or app secret
in either variable. `META_SYSTEM_USER_TOKEN` is a client fallback, not a
replacement for each workspace's authorized Embedded Signup connection.
Production mocks are disabled by code; do not introduce a review bypass.

Environment changes require a new deployment to take effect; public variables
must be present when the application is built. Use the existing PR workflow:

1. Prepare the real policy/runbook or other required application change on a
   branch, and configure the authorized production settings before its merge.
2. Open a PR and complete **Application CI**. `.github/workflows/ci.yml` runs
   tests, a production build and dependency audit, plus migrations 0001–0011,
   schema checks and routing assertions against disposable PostgreSQL 17.
   This job does not migrate the production database.
3. Merge only after review and green checks. Let the repository's Vercel Git
   integration build the approved merge commit. Do not run `vercel --prod`,
   direct promotion, or an empty/cosmetic commit to manufacture a release.
4. Confirm the deployment's project, domain and source commit. Check that the
   login form is available, real authentication works, and private routes deny
   an unauthenticated session. A `READY` deployment is insufficient evidence.

## Prepare reviewer access and the live fixture

Create a dedicated reviewer account and workspace using normal Xeccel account
setup after production access is working. Keep review credentials only in
Meta's designated access fields. Test the exact credentials in a fresh browser
session; do not provide a personal operator account or a developer bypass.

An owner/admin role is required to connect a channel or submit a template.
Prepare a business number and recipient authorized for this review. Keep the
existing WATI number connected until a separately planned migration is ready.
Do not substitute another tenant's credentials, number, messages or database.

Meta API Setup also provides a separate test sender, `+1 555 197 1757`, WABA
`1089733140351785`, Phone Number ID `1388060751057379`. Reconfirm that fixture
in the dedicated app before a permitted provider test and use an authorized
test recipient. This is a Meta test sender, not the WATI production number.
A successful API Setup test is separate from Embedded Signup, a saved Xeccel
workspace connection, signed webhook ingestion and the reviewer inbox journey.
Do not insert a connection into the database to simulate completed onboarding.

Production sends also require a current `active` or `trialing` subscription
and an explicit `whatsapp_send` entitlement. A fresh signup does not receive
these automatically. No customer activation writer exists in the current
billing foundation. Establish an approved, auditable review-trial activation
path before promising a working messaging demonstration; retain the entitlement
check and do not represent a test/trial workspace as a paid customer.

Configure the public website/platform and permitted SDK/OAuth origins in Meta
for the same hostname used in the recording. Verify the app's webhook callback
at `https://xeccel.com/api/webhooks/meta` using the secret configured above,
then verify signed event ingestion. The stored WABA and phone-number mapping
must belong to the review workspace.

## Permission evidence and reviewer steps

Xeccel sign-in uses Neon email/password. Facebook Embedded Signup authorizes
the business channel; it does not create the Xeccel login account.

### `whatsapp_business_management`

The permission is used to verify a selected WABA's phone-number ownership,
read number inventory and status, subscribe the WABA to app webhooks, and read
or submit message templates for the authorized business workspace.

1. Sign in at `https://xeccel.com/login` with the supplied review account.
2. Open `/settings/waba`, enter a **Channel name**, and click **Connect with
   Meta Embedded Signup**. Complete the Meta authorization with the permitted
   business, WABA and number.
3. Return to Xeccel and inspect the stored WABA/Phone ID. Click **Check with
   Meta** and show the returned inventory, quality and verification fields.
4. Open `/templates` to retrieve the WABA's live templates. If template creation
   is part of the requested use, open `/templates/new`, enter the review template
   and click **Submit Template for Meta Approval**. Show the actual provider
   response; submission is not approval.

### `whatsapp_business_messaging`

The permission is used to receive customer messages and reply through a
workspace's authorized sender, with signed webhook delivery-status events.
The production path supports text and approved templates; media, interactive
messages and campaign dispatch are not part of this review journey.

1. Send an actual WhatsApp message from the authorized recipient to the review
   business number. Open `/inbox` and show the inbound conversation.
2. Select the conversation, type a reply and send it during the customer service
   window. Show its receipt on the recipient device and the recorded status.
3. Click **Send Template**, choose a template actually approved for this WABA
   and language, enter required variables, and send to the authorized recipient.
4. Demonstrate the service-window restriction accurately. Freeform text is
   blocked outside 24 hours; an approved template is required. Do not change
   timestamps or fabricate an expired conversation to claim provider acceptance.

The server sends via `/{phone_number_id}/messages`, checks that the recipient
matches the tenant conversation, and checks approved templates against Meta.
If a provider result is uncertain, reconcile the existing request rather than
sending again with a new idempotency key.

### `public_profile`

The code initializes Facebook's SDK for Embedded Signup but does not call `/me`,
read profile pictures, or persist a Facebook public profile for Xeccel login.
Do not claim that this permission powers workspace signup or profile display.
Use only the permission explanation supported by Meta's actual configuration
and the demonstrated flow; omit an optional permission that has no implemented
use rather than inventing one.

## Public policy URLs and recording

- Privacy: `https://xeccel.com/legal/privacy`
- Terms: `https://xeccel.com/legal/terms`
- Data-deletion instructions: `https://xeccel.com/legal/data-deletion`

The deletion URL becomes available only after the corresponding policy change
is merged and deployed. It describes the existing email-based request process,
not an automated deletion callback. Confirm all three URLs load without a
login on the deployed domain before entering them in Meta.

Record the real configured application, the Meta authorization and the
permission-specific actions above. Keep passwords, tokens and unrelated
customer data out of the video. `public/media/` contains concept and marketing
films, not App Review evidence; do not use them as a functional screencast.

Before final submission, retain the deployed commit, working policy URLs,
review-account access check, WABA/Phone Number IDs, recording reference and
real message/receipt evidence in the appropriate restricted review records.
Enter accurate business, processor and data-handling answers confirmed by the
owner. Do not infer government-request procedures, deletion completion,
processor locations or provider approval from this repository.

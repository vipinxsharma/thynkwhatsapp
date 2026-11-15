# Xeccel Android and iOS release track

The app under `apps/mobile` is a native Expo/React Native foundation. It is **not** a
store-submission artifact, live WhatsApp client, or substitute for Meta App Review.
No store release should be initiated from this preview.

## Product scope

The first releasable mobile product is for members of a customer's Xeccel
workspace: securely sign in, choose an authorized workspace, read assigned
conversations, reply within the provider-permitted window, receive relevant
notifications, and hand an issue to a teammate. Do not present mock inbox data
as a customer's messages or enable sends before the production entitlement,
channel, and provider checks pass.

## Ordered gates

1. Implement a mobile-specific authentication flow. The existing web session is
   cookie-based; do not embed the web session JWT, password, or Meta token in the
   mobile bundle. A short-lived, single-use authorization exchange and securely
   stored revocable mobile session need a reviewed backend PR.
2. Build native inbox, message detail, reply, handoff, and account screens
   against the existing tenant-scoped APIs. The app must show an explicit empty
   or unavailable state when durable storage, entitlements, or Meta delivery
   are not ready. Add device tests for login, tenant isolation, offline state,
   notification routing, and logout.
3. Review the generated square Xeccel X icon with the brand owner and create
   final splash assets. Verify adaptive-icon cropping, light/dark layouts,
   accessibility, and real devices before treating the icon as final.
4. Confirm the owning ThynkWISE Advisors organization accounts in Google Play
   Console and Apple Developer/App Store Connect. Select permanent Android
   package and iOS bundle IDs before creating store records or signing builds.
   Keep signing keys and store credentials outside Git.
5. Add fail-closed signed Android App Bundle and iOS archive workflows through
   PRs. Build and test through internal testing and TestFlight before public
   review. Prepare accurate store descriptions, screenshots, privacy/data-safety
   disclosures, support and deletion URLs, and reviewer access to a working
   demo workspace with live backend services.
6. Submit to Google and Apple only after the native journeys and provider
   integration work end to end. Track each store's review separately from Meta
   access verification, Meta App Review, and public customer rollout.

The initial SDK 57 dependency audit reports transitive high/moderate advisories
in Expo/React Native's build and runtime dependency trees. Bundle and type
checks passing does not clear them. Triage the affected packages and update to
patched, SDK-compatible releases before a signed store build; do not use a
forced downgrade to an unsupported Expo SDK as an audit workaround.

Meta's Basic Settings Android/iOS platform fields are not store submissions.
Leave package/bundle identifiers blank until the corresponding mobile build
identities are chosen and verified; do not invent a Play Store ID or App Store ID.

## Local preview

Run `npm ci` in `apps/mobile`, then `npm start`. The preview uses the same
orange/navy Xeccel palette as the web app and links to current web account,
privacy, terms, and support pages. It deliberately does not request messaging
permissions or store customer data.

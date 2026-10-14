# Xeccel policy publication review

The public pages in this PR are Xeccel-specific drafts. They must be approved
by the business owner and legal/compliance reviewer before this PR is merged.
The site does not collect public payments today; these pages do not activate
Cashfree, a billing plan, or recurring mandates.

## Confirm before publication

1. Confirm the merchant/legal entity, registered address, support email and
   phone against the dedicated Xeccel Cashfree MID application. The current
   copy uses ThynkWISE Advisors Private Limited and its published parent-site
   contact details; replace these if Xeccel will use a distinct support desk.
2. Approve the commercial rules: cancellation effective date, treatment of
   used subscription periods and metered WhatsApp/AI charges, duplicate and
   failed-payment handling, and the proposed two-business-day acknowledgement
   and five-business-day refund-initiation targets.
3. Before any checkout is enabled, make the plan price, tax, billing period,
   renewal/mandate choice, usage rates, entitlement activation, and service
   delivery expectations visible in the actual order/checkout flow. A policy
   page is not a substitute for purchase-time disclosure.
4. Audit actual Xeccel cookies, analytics, payment events, AI providers,
   sub-processors, retention/deletion procedures, and contact request path.
   Update the privacy and cookie pages to match the deployed configuration.
5. Confirm the WhatsApp, AI and later SMS acceptable-use terms against provider
   agreements and the enabled product. Verify legal jurisdiction and any
   customer-specific DPA/order terms with counsel.
6. Test all policy links on the Xeccel domain in light and dark modes and on
   mobile. Confirm canonical URLs, 404 behavior and support mail/phone links.

Source references used for structure and identity, not copied text:
[thynkWISE privacy](https://www.thynkwise.ai/privacy-policy),
[thynkWISE terms](https://www.thynkwise.ai/terms),
[thynkWISE trust center](https://www.thynkwise.ai/trust), and
[Cashfree merchant terms](https://www.cashfree.com/tnc).

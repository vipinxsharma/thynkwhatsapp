# DRAFT: Privacy and cookie consent wording for xeccel.com

> **Status: DRAFT. Not approved. Not shown in the UI.**
> For review by a person responsible for legal and compliance before any of this text is used.
> Do not publish or merge these paragraphs without that sign-off.

## Why this draft exists

The consent banner ships before any optional analytics or advertising tag. The current Privacy Policy and Cookie Policy (`lib/legal/policies.ts`) do not yet describe:

- how a visitor's choice is recorded,
- what Accept and Reject change,
- advertising, remarketing or retargeting, which are not installed.

The wording below is for the legal review. It is not copy for the banner, which must stay short.

## Draft paragraphs for the Privacy Policy

**Cookie choices.** When you first visit xeccel.com, we ask whether you accept optional cookies. We store your choice in your browser's local storage under the key `xeccel_cookie_consent` so we do not ask again. Essential cookies that keep the site working are not affected by your choice.

**Accept.** If you accept, we may use optional analytics cookies. These help us understand how the site is used. [ANALYTICS PROVIDER AND PURPOSE TO BE CONFIRMED BEFORE GA4 IS ADDED.]

**Reject.** If you reject, we do not load optional analytics or marketing tags. We also expire the optional analytics cookies already in your browser for xeccel.com.

**Advertising and retargeting. [NOT IN USE TODAY. DO NOT PUBLISH UNTIL ADS OR PIXELS ARE INSTALLED.]** If we later use advertising or retargeting tags (for example Google Ads or Meta Pixel), we will describe them here, say which signals each tag uses, and load them only after you accept. We will say how to withdraw consent.

**Changing your choice.** Use "Cookie settings" in the footer at any time to change your choice.

## Open points for legal

1. Confirm the lawful basis and consent standard for India (the business operator is ThynkWISE Advisors Private Limited) and for visitors from the EU/UK, if any.
2. Confirm whether "Reject" must be as prominent as "Accept" under the applicable rules. The banner gives them equal weight.
3. Confirm whether the Cookie Policy must list each cookie name, including the `_ga` family, before analytics is enabled.
4. Confirm the wording for the analytics provider once the GA4 measurement ID exists.
5. Confirm the retention period for the consent record in localStorage and any server-side log, if one is later added.

## Not covered here

- Lead-form consent checkboxes. This repo has none today.
- Booking flows. This repo has none today.
- Any business data processing agreement with a messaging provider.

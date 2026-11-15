export const legalContact = {
  entity: "ThynkWISE Advisors Private Limited",
  email: "partner@thynkwise.co.in",
  phone: "+91 97630 08800",
  address: "S.No. 17/10/1/57, F.No. A-406, Star Gaze, Lohgaon, Dhanori, Pune, Maharashtra 411015, India",
} as const;

export type Policy = {
  slug: string;
  title: string;
  summary: string;
  updatedAt?: string;
  sections: { heading: string; paragraphs: string[]; bullets?: string[] }[];
};

export const policies: Policy[] = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    summary: "What Xeccel collects, why we use it, and how to make a data request.",
    sections: [
      { heading: "Who operates Xeccel", paragraphs: ["Xeccel is a business messaging platform operated by ThynkWISE Advisors Private Limited. This notice covers xeccel.com and Xeccel workspaces. If we process a customer's contact or message data on behalf of a business customer, that business controls the messaging purpose and our agreement with it also applies."] },
      { heading: "Information we handle", paragraphs: ["We may handle account and business details, workspace membership, support requests, sender and contact identifiers, messages and attachments submitted through the service, technical logs, and subscription or transaction records. We receive WhatsApp account and message events from Meta when a customer connects an authorised channel. Do not send passwords, card numbers, OTPs, or unnecessary sensitive information to support or AI features."] },
      { heading: "Why we use it", paragraphs: ["We use information to provide and secure the service, connect authorised channels, route conversations, support customers, maintain billing records, prevent abuse, and meet legal obligations. We use AI-assisted features only for the workflow selected by the customer and subject to the controls described in our terms. Marketing messages require an appropriate opt-in and include a way to stop them."] },
      { heading: "Providers and transfers", paragraphs: ["Service providers may process data for hosting, authentication, communications, AI features, Meta WhatsApp connectivity, and payment processing when enabled. We do not sell customer message content. Providers may process data outside your country; the applicable customer agreement and provider arrangements govern those transfers. A current sub-processor list can be requested from us."] },
      { heading: "Retention and security", paragraphs: ["We retain records for the service relationship and only as long as needed for support, security, billing, dispute resolution, or legal obligations. Retention may differ for messages, logs, and invoices. We use access controls and technical safeguards, but no service can promise absolute security. Customers should manage their own users, permissions, consent, and retention settings."] },
      { heading: "Your choices and requests", paragraphs: ["You may ask us about access, correction, deletion, export, or withdrawal of consent where applicable. A business customer's end user should first contact that business for requests about messages it controls. Email partner@thynkwise.co.in with your request; we may verify your identity and may retain records required by law or a legitimate dispute. We will respond under applicable law and our customer agreement."] },
    ],
  },
  {
    slug: "data-deletion",
    title: "Data Deletion Instructions",
    summary: "How to request deletion of your Xeccel account, workspace data, or connected-channel information.",
    updatedAt: "20 October 2026",
    sections: [
      { heading: "Request deletion by email", paragraphs: ["Email partner@thynkwise.co.in with the subject \"Xeccel data deletion request\". Include the email used for your Xeccel account, the workspace name or reference if known, and the account or data you want deleted. A workspace owner requesting deletion of connected WhatsApp information can include the business number or WABA reference. Do not send passwords, access tokens, OTPs, or full payment-card details."] },
      { heading: "Requests about a business's conversations", paragraphs: ["If you contacted a business that uses Xeccel, first ask that business to delete the messages or contact data it controls. If you need help identifying the relevant workspace, email us with the business name and the minimum information needed to locate your request."] },
      { heading: "What happens next", paragraphs: ["Deletion requests are handled by our team; this page is not an automatic deletion tool. We may need to verify your identity or authority over the workspace and clarify which records your request covers. As described in our Privacy Policy, records required for legal obligations, billing, security, or a legitimate dispute may need to be retained. We will respond under applicable law and the customer agreement."] },
      { heading: "Connected Meta accounts", paragraphs: ["Removing Xeccel's access in Meta's settings and requesting deletion of data already held by Xeccel are separate steps. Use the email process above to request deletion of Xeccel-held information. This request does not by itself delete your WhatsApp Business Account or records held independently by Meta or the business you contacted."] },
    ],
  },
  {
    slug: "terms",
    title: "Terms of Service",
    summary: "The rules for using Xeccel, including accounts, third-party channels, and billing.",
    sections: [
      { heading: "Scope and availability", paragraphs: ["These terms govern xeccel.com and Xeccel services provided by ThynkWISE Advisors Private Limited. Start account setup through Get started or contact our team for assistance. Workspace access and paid messaging activation are separate steps. A written order or subscription agreement may set additional commercial terms and prevails where it conflicts with these website terms."] },
      { heading: "Accounts and permissions", paragraphs: ["A workspace owner is responsible for authorised users, account security, and the accuracy of business information. Do not share login credentials or connect a sender that you do not control. We may verify ownership and reject a connection that cannot be confirmed."] },
      { heading: "WhatsApp and other channels", paragraphs: ["Meta, telecom operators, and other channel providers control their own approval, templates, delivery, limits, pricing, and policies. Xeccel cannot guarantee a phone number will be accepted or that a message will be delivered. You must obtain lawful contact consent, honour opt-outs, use approved templates where required, and comply with provider rules. SMS, if offered later, will have separate DLT and operator requirements."] },
      { heading: "AI assistance", paragraphs: ["AI-generated suggestions can be incomplete or wrong. Your team remains responsible for reviewing important replies and decisions. Do not use Xeccel AI to provide unreviewed legal, medical, financial, or other high-stakes advice. Human handoff and service limitations will be disclosed for each enabled feature."] },
      { heading: "Prices and payments", paragraphs: ["No public payment is currently collected through this site. Before a paid order, the applicable checkout or written order will show the plan, billing period, currency, taxes, included limits, variable usage charges, renewal method, and any applicable trial terms. Charges incurred with third-party providers may be separate. Payment and account activation are not proof of Meta or operator approval."] },
      { heading: "Cancellation, suspension, and changes", paragraphs: ["Cancellation and refund rules are in our Refunds and Cancellations Policy or your written order. We may suspend access for security risk, unlawful messaging, provider restriction, material breach, or non-payment, with notice where practical. We may update the service and these terms; material changes will be identified by an updated date or a direct notice when appropriate. Mandatory legal rights are unaffected."] },
      { heading: "Contact", paragraphs: ["Questions about these terms or a commercial order can be sent to partner@thynkwise.co.in. The registered business contact details are listed in the Xeccel Legal Center."] },
    ],
  },
  {
    slug: "refunds-cancellations",
    title: "Refunds & Cancellations",
    summary: "How a Xeccel customer can cancel a future charge or resolve a payment issue.",
    sections: [
      { heading: "Current payment status", paragraphs: ["Visiting this site or starting account setup does not create a paid subscription or charge. Online checkout is not available; any paid service requires a confirmed written order showing the price, billing period, taxes, renewal method, and usage-based charges."] },
      { heading: "Cancel a subscription", paragraphs: ["The workspace owner or authorised billing contact can request cancellation at partner@thynkwise.co.in, citing the workspace and order or invoice reference. We will confirm the effective date in writing. Unless a written order or applicable law says otherwise, cancellation stops future renewals at the end of the paid period; it does not automatically erase charges already incurred. A one-time checkout is not, by itself, a recurring payment mandate."] },
      { heading: "When a refund may apply", paragraphs: ["Tell us if the same order was charged twice, the amount was wrong, or a purchased service could not be activated or supplied. We will reconcile the order and payment records and refund the duplicate or excess charge, or the affected undelivered purchase if it cannot be resolved. A failed or pending payment that debited your account must first be reconciled with the payment provider. Any statutory right or more favourable written agreement remains in force."] },
      { heading: "Used periods and third-party usage", paragraphs: ["We do not ordinarily prorate an activated subscription period because of unused seats or a change of mind. Messaging, carrier, AI, and other metered usage already consumed is not ordinarily refundable. Documented service-delivery issues are reviewed individually; this does not limit remedies required by law."] },
      { heading: "Request and timing", paragraphs: ["Email partner@thynkwise.co.in with the workspace, order or invoice reference, payment date, and a short description of the issue. Do not send card numbers, CVVs, passwords, or OTPs. We aim to acknowledge the request within two business days. After approval, we aim to initiate a refund to the original payment method within five business days; the bank or payment provider controls the final credit time. We will share a reference when available."] },
      { heading: "Data after cancellation", paragraphs: ["Cancelling billing and deleting workspace data are separate requests. Contact us for export or deletion. We may retain payment, tax, security, or dispute records where required."] },
    ],
  },
  {
    slug: "service-delivery",
    title: "Service Delivery & Fulfilment",
    summary: "What is delivered digitally, when access begins, and what requires provider approval.",
    sections: [
      { heading: "Digital service, no physical shipping", paragraphs: ["Xeccel is software delivered online. There are no physical goods, shipping charges, or delivery addresses for a Xeccel subscription. Any separate professional service is described in its written order."] },
      { heading: "Workspace activation", paragraphs: ["Use the setup guide or contact our team to begin account setup. Any paid order will explain the activation steps and expected timing. Account creation, payment confirmation, Meta business verification, phone-number registration, and live messaging are separate milestones. A connected account screen does not by itself confirm that a channel can send or receive live messages."] },
      { heading: "Provider-dependent features", paragraphs: ["WhatsApp channels require Meta approval and control of the relevant business account and number. SMS, if introduced, requires the applicable DLT and operator approvals. Templates, messaging limits, and delivery are also subject to provider rules. We will identify any incomplete step in the customer workflow and will not describe a provider-dependent feature as delivered before it is available."] },
      { heading: "If access cannot be supplied", paragraphs: ["If a purchased Xeccel service cannot be provisioned, contact partner@thynkwise.co.in. We will investigate, offer a remedy where possible, or review a refund under the Refunds and Cancellations Policy and the applicable order."] },
    ],
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    summary: "The site and account cookies Xeccel uses, and your available controls.",
    sections: [
      { heading: "What cookies are for", paragraphs: ["Cookies and similar browser storage help the site remember a choice or keep a signed-in workspace secure. Xeccel currently uses a theme preference cookie and, for signed-in users, authentication/session cookies. Hosting and security infrastructure may also set essential technical cookies."] },
      { heading: "Optional tracking", paragraphs: ["The current Xeccel site does not rely on advertising cookies to show its public pages. If optional analytics or marketing technologies are introduced, this policy and any required choice controls will be updated before they are used. Third-party links lead to sites with their own policies."] },
      { heading: "Your controls", paragraphs: ["You can clear or block cookies in your browser. Blocking essential cookies may stop sign-in or prevent a saved theme preference. You can change the light/dark theme using the site control. For questions, contact partner@thynkwise.co.in."] },
    ],
  },
  {
    slug: "messaging-use",
    title: "Messaging & Acceptable Use",
    summary: "Consent, sender ownership, opt-outs, and safe use of WhatsApp, SMS, and AI.",
    sections: [
      { heading: "Send only with permission", paragraphs: ["Customers must have a valid basis and any required opt-in to contact each recipient. Keep evidence of consent, respect opt-outs promptly, and follow applicable law and the rules of Meta and other channel providers. Do not upload purchased lists or use Xeccel for spam, fraud, harassment, or deceptive messages."] },
      { heading: "Approved channels and content", paragraphs: ["Connect only numbers and business accounts you are authorised to use. Use approved message templates and observe service windows, rate limits, DLT registration, and operator conditions where relevant. The workspace owner is responsible for users, content, customer notices, and the accuracy of uploaded contacts. Xeccel may restrict sends that fail required checks."] },
      { heading: "AI and escalation", paragraphs: ["AI assistance is not a substitute for human judgment. Review outputs before using them in consequential customer matters. Keep a human escalation path for unresolved issues and do not instruct an AI agent to misrepresent itself or conceal a material limitation."] },
      { heading: "Enforcement and reports", paragraphs: ["We may pause a workflow or workspace to investigate abuse, security risk, or a provider restriction. Report a concern at partner@thynkwise.co.in with the workspace and relevant message reference, not sensitive credentials."] },
    ],
  },
];

export function getPolicy(slug: string): Policy | undefined {
  return policies.find((policy) => policy.slug === slug);
}

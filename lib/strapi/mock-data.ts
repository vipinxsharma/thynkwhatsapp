import { Conversation, Message, MessageTemplate, PhoneNumber, WABAAccount } from "@/types/strapi";

export const initialWABA: WABAAccount = {
  id: 1,
  wabaId: "109823485723910",
  name: "thynkWISE Enterprise Solutions",
  currency: "INR",
  timezoneId: "Asia/Kolkata",
  accountReviewStatus: "APPROVED",
  webhookSubscribed: true,
  phoneNumbers: [
    {
      id: 1,
      phoneNumberId: "105678234901234",
      displayPhoneNumber: "+91 98765 43210",
      verifiedName: "thynkWISE Sales & Support",
      qualityRating: "GREEN",
      codeVerificationStatus: "VERIFIED",
    },
    {
      id: 2,
      phoneNumberId: "105678234901235",
      displayPhoneNumber: "+1 (415) 555-0199",
      verifiedName: "thynkWISE Global",
      qualityRating: "GREEN",
      codeVerificationStatus: "VERIFIED",
    },
  ],
};

export const initialConversations: Conversation[] = [
  {
    id: 1,
    status: "open",
    // 24 hours from now minus 3 hours (active window with 21 hours left)
    windowExpiresAt: new Date(Date.now() + 21 * 60 * 60 * 1000).toISOString(),
    lastMessageAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    unreadCount: 1,
    contact: {
      id: 101,
      waId: "919820011223",
      phoneNumber: "+919820011223",
      name: "Aarav Mehta",
      tags: ["Lead: High Intent", "Enterprise", "Retail"],
      customAttributes: {
        company: "Nexus Retail Group",
        estimatedARR: "$25,000",
        crmStage: "Negotiation",
      },
    },
    phoneNumber: initialWABA.phoneNumbers![0],
    lastMessage: {
      id: 1001,
      wamId: "wamid.HBgLOTE5ODIwMDExMjIzFQIAERgSRjQ1NjE0OUMyM0Y3",
      direction: "inbound",
      type: "text",
      body: "Can we schedule a live demo of the WhatsApp broadcast features tomorrow at 3 PM IST?",
      status: "read",
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    id: 2,
    status: "open",
    // Expired 2 hours ago (outside 24-hr window, requires HSM template)
    windowExpiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    lastMessageAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    unreadCount: 0,
    contact: {
      id: 102,
      waId: "14155559876",
      phoneNumber: "+14155559876",
      name: "Sophia Chen",
      tags: ["Customer: Paid", "Fintech"],
      customAttributes: {
        company: "Starlight Pay",
        tier: "Growth Plan",
        accountManager: "Vipin Sharma",
      },
    },
    phoneNumber: initialWABA.phoneNumbers![1],
    lastMessage: {
      id: 1002,
      wamId: "wamid.HBgLMTQxNTU1NTk4NzYFQIAERgSRjQ1NjE0OUMyM0Y4",
      direction: "outbound",
      type: "text",
      body: "Thanks Sophia, we have updated your monthly messaging quota to 50,000 messages.",
      status: "delivered",
      timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    id: 3,
    status: "pending",
    // 5 hours remaining in 24h window
    windowExpiresAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    lastMessageAt: new Date(Date.now() - 19 * 60 * 60 * 1000).toISOString(),
    unreadCount: 0,
    contact: {
      id: 103,
      waId: "919871122334",
      phoneNumber: "+919871122334",
      name: "Rohan Varma",
      tags: ["Support", "Priority"],
      customAttributes: {
        company: "Swift Logistics",
        ticketId: "TICK-9081",
      },
    },
    phoneNumber: initialWABA.phoneNumbers![0],
    lastMessage: {
      id: 1003,
      wamId: "wamid.HBgLOTE5ODcxMTIyMzM0FQIAERgSRjQ1NjE0OUMyM0Y5",
      direction: "inbound",
      type: "text",
      body: "Does the webhook support status receipts for failed delivery attempts with error codes?",
      status: "read",
      timestamp: new Date(Date.now() - 19 * 60 * 60 * 1000).toISOString(),
    },
  },
];

export const initialMessages: Record<string, Message[]> = {
  "1": [
    {
      id: 1,
      wamId: "wamid.HBgLOTE5ODIwMDExMjIzFQIAERgSRjA1",
      direction: "inbound",
      type: "text",
      body: "Hello! We are looking to migrate our marketing messaging from SMS to WhatsApp Business API.",
      status: "read",
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 2,
      wamId: "wamid.HBgLOTE5ODIwMDExMjIzFQIAERgSRjA2",
      direction: "outbound",
      type: "text",
      body: "Welcome to thynkWISE, Aarav! We provide official Meta Cloud API integration with 99.9% delivery uptime and multi-agent CRM inboxes. What monthly volume are you targeting?",
      status: "read",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 3,
      wamId: "wamid.HBgLOTE5ODIwMDExMjIzFQIAERgSRjA3",
      direction: "inbound",
      type: "text",
      body: "We send roughly 250,000 order confirmations and promotional alerts per month across India.",
      status: "read",
      timestamp: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 4,
      wamId: "wamid.HBgLOTE5ODIwMDExMjIzFQIAERgSRjA0",
      direction: "inbound",
      type: "text",
      body: "Can we schedule a live demo of the WhatsApp broadcast features tomorrow at 3 PM IST?",
      status: "read",
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
  ],
  "2": [
    {
      id: 10,
      wamId: "wamid.HBgLMTQxNTU1NTk4NzYFQIAERgSRjEw",
      direction: "inbound",
      type: "text",
      body: "Hi team, we need to increase our sending tier before the Black Friday sale next week.",
      status: "read",
      timestamp: new Date(Date.now() - 27 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 11,
      wamId: "wamid.HBgLMTQxNTU1NTk4NzYFQIAERgSRjEx",
      direction: "outbound",
      type: "text",
      body: "Thanks Sophia, we have updated your monthly messaging quota to 50,000 messages.",
      status: "delivered",
      timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    },
  ],
  "3": [
    {
      id: 20,
      wamId: "wamid.HBgLOTE5ODcxMTIyMzM0FQIAERgSRjIw",
      direction: "inbound",
      type: "text",
      body: "Does the webhook support status receipts for failed delivery attempts with error codes?",
      status: "read",
      timestamp: new Date(Date.now() - 19 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

export const sampleTemplates: MessageTemplate[] = [
  {
    id: 1,
    metaTemplateId: "tpl_meta_101",
    name: "order_confirmation_v1",
    language: "en_US",
    category: "UTILITY",
    status: "APPROVED",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Order #{{1}} Confirmed!",
      },
      {
        type: "BODY",
        text: "Hi {{1}}, thanks for choosing thynkWISE. Your order has been processed and will dispatch shortly.",
      },
      {
        type: "FOOTER",
        text: "thynkWISE Automated Notification",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Track Shipment",
            url: "https://thynkwise.co.in/track/{{1}}",
          },
        ],
      },
    ],
  },
  {
    id: 2,
    metaTemplateId: "tpl_meta_102",
    name: "reengage_24h_window_expired",
    language: "en_US",
    category: "MARKETING",
    status: "APPROVED",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Following up from thynkWISE",
      },
      {
        type: "BODY",
        text: "Hi {{1}}, our customer specialist wanted to follow up on your recent question. Would you like to continue our conversation?",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "QUICK_REPLY",
            text: "Yes, continue chat",
          },
          {
            type: "QUICK_REPLY",
            text: "Not right now",
          },
        ],
      },
    ],
  },
  {
    id: 3,
    metaTemplateId: "tpl_meta_103",
    name: "flash_sale_announcement",
    language: "en_US",
    category: "MARKETING",
    status: "APPROVED",
    components: [
      {
        type: "HEADER",
        format: "IMAGE",
      },
      {
        type: "BODY",
        text: "Special VIP Offer: Get 20% off all enterprise plans this week only! Reply 'OFFER' or click below.",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Claim Discount",
            url: "https://thynkwise.co.in/vip",
          },
        ],
      },
    ],
  },
];

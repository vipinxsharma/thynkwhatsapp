"use client";

import { useState } from "react";
import { Conversation, Message, MessageTemplate } from "@/types/strapi";
import { ConversationList } from "./ConversationList";
import { MessageThread } from "./MessageThread";
import { MessageInput } from "./MessageInput";
import { ContactDetailsSidebar } from "./ContactDetailsSidebar";
import { TemplateSelectorModal } from "./TemplateSelectorModal";
import { Sparkles, Phone, Video, MoreVertical, Play } from "lucide-react";
import { formatPhoneNumber } from "@/lib/utils";

interface UnifiedInboxProps {
  initialConversations: Conversation[];
  initialMessages: Record<string, Message[]>;
  templates: MessageTemplate[];
}

export function UnifiedInbox({
  initialConversations,
  initialMessages,
  templates,
}: UnifiedInboxProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>(initialMessages);
  const [activeId, setActiveId] = useState<number | string>(
    initialConversations[0]?.id || "1"
  );
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSimulatingInbound, setIsSimulatingInbound] = useState(false);

  const activeConversation = conversations.find((c) => String(c.id) === String(activeId));
  const activeMessages = messagesMap[String(activeId)] || [];

  // 1. Send freeform outbound message
  const handleSendMessage = async (text: string) => {
    if (!activeConversation) return;

    try {
      const res = await fetch("/api/whatsapp/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          recipientPhone: activeConversation.contact.phoneNumber,
          phoneNumberId: activeConversation.phoneNumber.phoneNumberId,
          messageType: "text",
          text,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        alert(`Failed to send message: ${json.message || json.error}`);
        return;
      }

      // Append sent message to local state
      const newMsg: Message = json.data;
      setMessagesMap((prev) => ({
        ...prev,
        [String(activeId)]: [...(prev[String(activeId)] || []), newMsg],
      }));

      // Update conversation preview
      setConversations((prev) =>
        prev.map((c) =>
          String(c.id) === String(activeId)
            ? {
                ...c,
                lastMessage: newMsg,
                lastMessageAt: newMsg.timestamp,
              }
            : c
        )
      );
    } catch (err: any) {
      alert(`Error sending message: ${err.message}`);
    }
  };

  // 2. Send approved HSM template (works outside 24h window)
  const handleSendTemplate = async (
    templateName: string,
    language: string,
    variables: string[]
  ) => {
    if (!activeConversation) return;

    try {
      const res = await fetch("/api/whatsapp/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          recipientPhone: activeConversation.contact.phoneNumber,
          phoneNumberId: activeConversation.phoneNumber.phoneNumberId,
          messageType: "template",
          templateName,
          templateLanguage: language,
          templateVariables: variables,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        alert(`Failed to send template: ${json.message || json.error}`);
        return;
      }

      const newMsg: Message = json.data;
      setMessagesMap((prev) => ({
        ...prev,
        [String(activeId)]: [...(prev[String(activeId)] || []), newMsg],
      }));

      setConversations((prev) =>
        prev.map((c) =>
          String(c.id) === String(activeId)
            ? {
                ...c,
                lastMessage: newMsg,
                lastMessageAt: newMsg.timestamp,
              }
            : c
        )
      );
    } catch (err: any) {
      alert(`Error sending template: ${err.message}`);
    }
  };

  // 3. Simulate Incoming WhatsApp Webhook (for live local testing)
  const handleSimulateInbound = async () => {
    if (!activeConversation || isSimulatingInbound) return;
    setIsSimulatingInbound(true);

    try {
      const simulatedWamid = `wamid.HBgL${Date.now()}`;
      const responses = [
        "Sounds great! Please send over the proposal document.",
        "Yes, I would like to proceed with the enterprise setup.",
        "Can you clarify your SLA for webhook message delivery?",
        "Thank you! We received the template update.",
      ];
      const randomText = responses[Math.floor(Math.random() * responses.length)];

      const webhookPayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "109823485723910",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: activeConversation.phoneNumber.displayPhoneNumber,
                    phone_number_id: activeConversation.phoneNumber.phoneNumberId,
                  },
                  contacts: [
                    {
                      profile: { name: activeConversation.contact.name },
                      wa_id: activeConversation.contact.waId,
                    },
                  ],
                  messages: [
                    {
                      from: activeConversation.contact.waId,
                      id: simulatedWamid,
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      type: "text",
                      text: { body: randomText },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const res = await fetch("/api/webhooks/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      });

      if (res.ok) {
        // Optimistically update thread and 24h window
        const inboundMessage: Message = {
          id: Date.now(),
          wamId: simulatedWamid,
          direction: "inbound",
          type: "text",
          body: randomText,
          status: "received",
          timestamp: new Date().toISOString(),
        };

        setMessagesMap((prev) => ({
          ...prev,
          [String(activeId)]: [...(prev[String(activeId)] || []), inboundMessage],
        }));

        setConversations((prev) =>
          prev.map((c) =>
            String(c.id) === String(activeId)
              ? {
                  ...c,
                  lastMessage: inboundMessage,
                  lastMessageAt: inboundMessage.timestamp,
                  // Renew the 24-hour window!
                  windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                }
              : c
          )
        );
      }
    } catch (err: any) {
      console.error("Simulation error:", err);
    } finally {
      setIsSimulatingInbound(false);
    }
  };

  // 4. Update tags
  const handleUpdateTags = (newTags: string[]) => {
    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(activeId)
          ? {
              ...c,
              contact: { ...c.contact, tags: newTags },
            }
          : c
      )
    );
  };

  // 5. Update status
  const handleUpdateStatus = (status: Conversation["status"]) => {
    setConversations((prev) =>
      prev.map((c) => (String(c.id) === String(activeId) ? { ...c, status } : c))
    );
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full">
      {/* 1. Conversations Column */}
      <ConversationList
        conversations={conversations}
        activeConversationId={activeId}
        onSelectConversation={(id) => setActiveId(id)}
      />

      {/* 2. Middle Chat Thread Column */}
      {activeConversation ? (
        <div className="flex-1 flex flex-col min-w-0 bg-[#0b141a]">
          {/* Thread Header */}
          <div className="h-16 px-4 border-b border-white/5 bg-[#0e131b] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-bold text-sm shadow-glow">
                {activeConversation.contact.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">
                  {activeConversation.contact.name}
                </h2>
                <p className="text-xs text-gray-400 font-mono">
                  {formatPhoneNumber(activeConversation.contact.phoneNumber)}
                </p>
              </div>
            </div>

            {/* Quick Webhook Simulator & Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSimulateInbound}
                disabled={isSimulatingInbound}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/50 text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
                title="Trigger simulated Meta inbound webhook"
              >
                <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                <span>{isSimulatingInbound ? "Simulating..." : "Test Inbound Webhook"}</span>
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <MessageThread
            messages={activeMessages}
            customerName={activeConversation.contact.name}
          />

          {/* Bottom Message Input Bar with 24h Protection */}
          <MessageInput
            windowExpiresAt={activeConversation.windowExpiresAt}
            onSendMessage={handleSendMessage}
            onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Select a conversation from the left to start messaging.
        </div>
      )}

      {/* 3. Right CRM Contact Sidebar */}
      {activeConversation && (
        <ContactDetailsSidebar
          conversation={activeConversation}
          onUpdateTags={handleUpdateTags}
          onUpdateStatus={handleUpdateStatus}
        />
      )}

      {/* Template Picker Modal */}
      {activeConversation && (
        <TemplateSelectorModal
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          templates={templates}
          recipientName={activeConversation.contact.name}
          onSendTemplate={handleSendTemplate}
        />
      )}
    </div>
  );
}

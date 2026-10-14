"use client";

import { useState, useEffect, useRef } from "react";
import { Conversation, Message, MessageTemplate } from "@/types/strapi";
import { ConversationList } from "./ConversationList";
import { MessageThread } from "./MessageThread";
import { MessageInput } from "./MessageInput";
import { ContactDetailsSidebar } from "./ContactDetailsSidebar";
import { TemplateSelectorModal } from "./TemplateSelectorModal";
import { MediaAttachmentModal } from "./MediaAttachmentModal";
import { Sparkles, Phone, Video, MoreVertical } from "lucide-react";
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
  const [hasOlderMap, setHasOlderMap] = useState<Record<string, boolean>>({});
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<number | string>(
    initialConversations[0]?.id || "1"
  );
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const pendingSendKeys = useRef(new Map<string, string>());
  const sendInFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const conversationId = String(activeId);
    if (!conversations.some((item) => String(item.id) === conversationId)) return;
    setThreadLoading(true);
    setThreadError(null);
    void fetch(`/api/inbox/messages?conversationId=${encodeURIComponent(conversationId)}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load messages");
        return result.data as { messages: Message[]; hasMore: boolean };
      })
      .then((page) => {
        setMessagesMap((current) => {
          const byId = new Map<string, Message>();
          for (const message of [...page.messages, ...(current[conversationId] || [])]) {
            byId.set(String(message.id), message);
          }
          return { ...current, [conversationId]: [...byId.values()].sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) };
        });
        setHasOlderMap((current) => ({ ...current, [conversationId]: page.hasMore }));
      })
      .catch((error) => {
        if (!controller.signal.aborted) setThreadError(error instanceof Error ? error.message : "Could not load messages");
      })
      .finally(() => { if (!controller.signal.aborted) setThreadLoading(false); });
    return () => controller.abort();
  // Conversations are scoped on the server; selection is the only fetch trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Real-Time Server-Sent Events (SSE) Listener
  useEffect(() => {
    const eventSource = new EventSource("/api/inbox/stream");

    eventSource.addEventListener("connected", () => {
      setIsLiveConnected(true);
    });

    eventSource.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { conversationId, message } = payload;

        if (message) {
          setMessagesMap((prev) => ({
            ...prev,
            [conversationId]: [...(prev[conversationId] || []), message],
          }));

          setConversations((prev) =>
            prev.map((c) =>
              String(c.id) === String(conversationId)
                ? {
                    ...c,
                    lastMessage: message,
                    lastMessageAt: message.timestamp,
                    windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                  }
                : c
            )
          );
        }
      } catch (err) {
        console.error("SSE message parse error:", err);
      }
    });

    eventSource.addEventListener("status", (event) => {
      try {
        const { wamId, status } = JSON.parse(event.data);
        setMessagesMap((prev) => {
          const updated = { ...prev };
          for (const key of Object.keys(updated)) {
            updated[key] = updated[key].map((m) => (m.wamId === wamId ? { ...m, status } : m));
          }
          return updated;
        });
      } catch (err) {
        console.error("SSE status parse error:", err);
      }
    });

    eventSource.onerror = () => {
      setIsLiveConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const activeConversation = conversations.find((c) => String(c.id) === String(activeId));
  const activeMessages = messagesMap[String(activeId)] || [];

  async function loadOlder() {
    const conversationId = String(activeId);
    const oldest = messagesMap[conversationId]?.[0];
    if (!oldest || threadLoading) return;
    setThreadLoading(true);
    setThreadError(null);
    try {
      const params = new URLSearchParams({
        conversationId, beforeTimestamp: String(oldest.timestamp), beforeId: String(oldest.id),
      });
      const response = await fetch(`/api/inbox/messages?${params}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load older messages");
      const page = result.data as { messages: Message[]; hasMore: boolean };
      setMessagesMap((current) => {
        const byId = new Map<string, Message>();
        for (const message of [...page.messages, ...(current[conversationId] || [])]) byId.set(String(message.id), message);
        return { ...current, [conversationId]: [...byId.values()] };
      });
      setHasOlderMap((current) => ({ ...current, [conversationId]: page.hasMore }));
    } catch (error) {
      setThreadError(error instanceof Error ? error.message : "Could not load older messages");
    } finally {
      setThreadLoading(false);
    }
  }

  async function sendToMeta(payload: Record<string, unknown>): Promise<Message> {
    if (sendInFlight.current) throw new Error("Another message is still being submitted");
    sendInFlight.current = true;
    try {
      const fingerprint = JSON.stringify(payload);
      let key = pendingSendKeys.current.get(fingerprint);
      if (!key) {
        key = crypto.randomUUID();
        pendingSendKeys.current.set(fingerprint, key);
      }
      const response = await fetch("/api/whatsapp/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: fingerprint,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || "Message was not confirmed");
      }
      pendingSendKeys.current.delete(fingerprint);
      return result.data as Message;
    } finally {
      sendInFlight.current = false;
    }
  }

  // 1. Send freeform outbound message
  const handleSendMessage = async (text: string) => {
    if (!activeConversation) return false;

    try {
      const newMsg = await sendToMeta({
          conversationId: activeConversation.id,
          recipientPhone: activeConversation.contact.phoneNumber,
          phoneNumberId: activeConversation.phoneNumber.phoneNumberId,
          messageType: "text",
          text,
      });

      // Append sent message to local state
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
      return true;
    } catch (err: any) {
      alert(`Error sending message: ${err.message}`);
      return false;
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
      const newMsg = await sendToMeta({
          conversationId: activeConversation.id,
          recipientPhone: activeConversation.contact.phoneNumber,
          phoneNumberId: activeConversation.phoneNumber.phoneNumberId,
          messageType: "template",
          templateName,
          templateLanguage: language,
          templateVariables: variables,
      });
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

  // 3. Send Rich Media (Image, Document/PDF, Interactive buttons)
  const handleSendMedia = async (payload: {
    messageType: "image" | "document" | "interactive";
    mediaUrl?: string;
    caption?: string;
    filename?: string;
    interactiveButtons?: Array<{ id: string; title: string }>;
    text?: string;
  }) => {
    if (!activeConversation) return;

    try {
      const newMsg = await sendToMeta({
          conversationId: activeConversation.id,
          recipientPhone: activeConversation.contact.phoneNumber,
          phoneNumberId: activeConversation.phoneNumber.phoneNumberId,
          ...payload,
      });
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
      alert(`Error sending rich media: ${err.message}`);
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

            {/* This connection reflects only the current app instance. */}
            <div className="flex items-center gap-2.5">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                  isLiveConnected
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}
                title={isLiveConnected ? "Connected to this app instance's event stream; refresh to confirm stored messages" : "Reconnecting to event stream"}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isLiveConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                  }`}
                />
                <span>{isLiveConnected ? "Updates connected" : "Connecting..."}</span>
              </div>
            </div>
          </div>

          {/* Messages Stream */}
          {threadError && <p role="alert" className="px-4 py-2 text-xs text-red-300">{threadError}</p>}
          {hasOlderMap[String(activeId)] && <button type="button" onClick={loadOlder} disabled={threadLoading}
            className="mx-auto mt-2 rounded-lg border border-white/10 px-3 py-1 text-xs text-gray-200 disabled:opacity-50">
            {threadLoading ? "Loading..." : "Load older messages"}
          </button>}
          <MessageThread
            messages={activeMessages}
            customerName={activeConversation.contact.name}
            loading={threadLoading}
          />

          {/* Bottom Message Input Bar with 24h Protection */}
          <MessageInput
            windowExpiresAt={activeConversation.windowExpiresAt}
            onSendMessage={handleSendMessage}
            onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
            onOpenMediaModal={() => setIsMediaModalOpen(true)}
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

      {/* Rich Media & Interactive Buttons Modal */}
      {activeConversation && (
        <MediaAttachmentModal
          isOpen={isMediaModalOpen}
          onClose={() => setIsMediaModalOpen(false)}
          onSendMedia={handleSendMedia}
        />
      )}
    </div>
  );
}

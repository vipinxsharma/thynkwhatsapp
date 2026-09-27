"use client";

import { useEffect, useRef } from "react";
import { Message } from "@/types/strapi";
import {
  Check,
  CheckCheck,
  AlertCircle,
  FileText,
  Download,
  ExternalLink,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react";

interface MessageThreadProps {
  messages: Message[];
  customerName: string;
}

export function MessageThread({ messages, customerName }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const renderStatus = (status: Message["status"]) => {
    switch (status) {
      case "read":
        return <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />;
      case "delivered":
        return <CheckCheck className="w-3.5 h-3.5 text-gray-400" />;
      case "sent":
        return <Check className="w-3.5 h-3.5 text-gray-400" />;
      case "failed":
        return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 whatsapp-pattern space-y-3">
      {/* Date Header Separator */}
      <div className="flex justify-center my-2">
        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#182229]/90 text-gray-400 border border-white/5 shadow-sm">
          Today
        </span>
      </div>

      {messages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-xs text-gray-500">
          No messages yet in this conversation.
        </div>
      ) : (
        messages.map((msg) => {
          const isOutbound = msg.direction === "outbound";
          const raw = msg.rawPayload || {};
          const isImage = msg.type === "image" || !!raw.image?.link || !!raw.mediaUrl?.match(/\.(jpeg|jpg|gif|png|webp)/i);
          const isDoc = msg.type === "document" || !!raw.document?.link;
          const isInteractive = msg.type === "interactive" || !!raw.interactive?.action?.buttons || !!raw.buttons;

          return (
            <div
              key={msg.id || msg.wamId}
              className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 shadow-sm text-sm relative ${
                  isOutbound
                    ? "bg-[#005c4b] text-white rounded-tr-none border border-emerald-600/30"
                    : "bg-[#202c33] text-gray-100 rounded-tl-none border border-white/5"
                }`}
              >
                {/* Outbound Template Badge */}
                {msg.type === "template" && (
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-700/40">
                    <Sparkles className="w-3 h-3" />
                    <span>WhatsApp HSM Template</span>
                  </div>
                )}

                {/* Image Media Rendering */}
                {isImage && (
                  <div className="mb-2 rounded-xl overflow-hidden border border-white/10 bg-black/40">
                    {/* eslint-disable-next-js-image */}
                    <img
                      src={raw.mediaUrl || raw.image?.link || "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80"}
                      alt="WhatsApp Media Asset"
                      className="max-h-60 w-full object-cover hover:opacity-95 transition-opacity"
                    />
                  </div>
                )}

                {/* Document / PDF Rendering */}
                {isDoc && (
                  <div className="mb-2 p-2.5 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {raw.filename || raw.document?.filename || "WhatsApp_Attachment.pdf"}
                        </p>
                        <p className="text-[10px] text-gray-400">PDF Document • Ready to view</p>
                      </div>
                    </div>
                    {(raw.mediaUrl || raw.document?.link) && (
                      <a
                        href={raw.mediaUrl || raw.document?.link}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all flex-shrink-0"
                        title="Download Document"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                )}

                {/* Message Text Body */}
                {msg.body && (
                  <p className="whitespace-pre-wrap leading-relaxed break-words text-sm">
                    {msg.body}
                  </p>
                )}

                {/* Interactive CTA Buttons Rendering */}
                {isInteractive && (
                  <div className="mt-2.5 pt-2 border-t border-white/10 space-y-1.5">
                    {(raw.interactive?.action?.buttons || raw.buttons || [
                      { reply: { title: "Interested" } },
                      { reply: { title: "Schedule Demo" } },
                    ]).map((btn: any, idx: number) => {
                      const title = btn.reply?.title || btn.title || btn.text || "Option";
                      return (
                        <div
                          key={idx}
                          className="w-full text-center py-1.5 px-3 rounded-lg bg-black/20 hover:bg-black/30 text-whatsapp-light font-medium text-xs border border-white/5 cursor-pointer transition-all active:scale-[0.98]"
                        >
                          {title}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Timestamp & Status Receipt */}
                <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-gray-300/80">
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {isOutbound && renderStatus(msg.status)}
                </div>
              </div>

              {/* Error indicator if failed */}
              {msg.status === "failed" && (
                <span className="text-[10px] text-red-400 mt-0.5 flex items-center gap-1">
                  Delivery Failed: {msg.errorMessage || "Meta Cloud API rejected message"}
                </span>
              )}
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}

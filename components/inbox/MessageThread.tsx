"use client";

import { useEffect, useRef } from "react";
import { Message } from "@/types/strapi";
import { Check, CheckCheck, AlertCircle, Bot, User } from "lucide-react";

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
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-700/40">
                    <span>Approved WhatsApp Template (HSM)</span>
                  </div>
                )}

                {/* Message Body */}
                <p className="whitespace-pre-wrap leading-relaxed break-words">{msg.body}</p>

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

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
  loading?: boolean;
}

export function MessageThread({ messages, customerName, loading = false }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const newestId = messages.at(-1)?.id;
  const lastNewestId = useRef<string | number | undefined>(undefined);

  useEffect(() => {
    if (newestId !== lastNewestId.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      lastNewestId.current = newestId;
    }
  }, [newestId]);

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
      {loading && messages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-xs text-gray-500">Loading messages...</div>
      ) : messages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-xs text-gray-500">
          No messages yet in this conversation.
        </div>
      ) : (
        messages.map((msg) => {
          const isOutbound = msg.direction === "outbound";
          const raw = msg.rawPayload || {};
          const mediaKind = (["image", "video", "document"] as const).find((kind) => msg.type === kind || raw[kind]) ?? null;
          const mediaPart = mediaKind ? raw[mediaKind] : undefined;
          // Files Meta holds are streamed through the app; older rows keep their stored link.
          const mediaSrc = mediaPart?.id
            ? `/api/whatsapp/messages/${msg.id}/media`
            : (raw.mediaUrl || mediaPart?.link || null);
          const isImage = mediaKind === "image";
          const isVideo = mediaKind === "video";
          const isDoc = mediaKind === "document";
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
                    {mediaSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaSrc}
                        alt={mediaPart?.caption || "WhatsApp image"}
                        className="max-h-60 w-full object-cover hover:opacity-95 transition-opacity"
                      />
                    ) : (
                      <p className="p-6 text-center text-xs text-gray-400">Image unavailable</p>
                    )}
                  </div>
                )}

                {isVideo && (
                  <div className="mb-2 rounded-xl overflow-hidden border border-white/10 bg-black/40">
                    {mediaSrc ? (
                      <video src={mediaSrc} controls preload="metadata" className="max-h-60 w-full" />
                    ) : (
                      <p className="p-6 text-center text-xs text-gray-400">Video unavailable</p>
                    )}
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
                          {raw.filename || mediaPart?.filename || "Document"}
                        </p>
                        <p className="text-[10px] text-gray-400">{mediaSrc ? "Document" : "Document unavailable"}</p>
                      </div>
                    </div>
                    {mediaSrc && (
                      <a
                        href={mediaSrc}
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

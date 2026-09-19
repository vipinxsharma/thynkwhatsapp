"use client";

import { useState } from "react";
import { Send, FileText, Clock, AlertTriangle, Sparkles } from "lucide-react";
import { calculateWindowRemaining } from "@/lib/utils";

interface MessageInputProps {
  windowExpiresAt: string;
  onSendMessage: (text: string) => Promise<void>;
  onOpenTemplateModal: () => void;
  disabled?: boolean;
}

export function MessageInput({
  windowExpiresAt,
  onSendMessage,
  onOpenTemplateModal,
  disabled,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const windowStatus = calculateWindowRemaining(windowExpiresAt);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending || disabled) return;

    setSending(true);
    try {
      await onSendMessage(text.trim());
      setText("");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-white/5 bg-[#0d121a]">
      {/* 24-Hour Window Notification Bar */}
      <div
        className={`px-4 py-2 flex items-center justify-between text-xs transition-all ${
          windowStatus.isExpired
            ? "bg-amber-950/40 border-b border-amber-900/30 text-amber-300"
            : "bg-emerald-950/30 border-b border-emerald-900/20 text-emerald-300"
        }`}
      >
        <div className="flex items-center gap-2">
          {windowStatus.isExpired ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>
                <strong>24h Customer Service Window Closed.</strong> Meta Cloud API requires an
                approved HSM template.
              </span>
            </>
          ) : (
            <>
              <Clock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>
                <strong>Active 24h Window:</strong> {windowStatus.formatted}. Freeform text allowed.
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenTemplateModal}
          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded bg-white/10 hover:bg-white/15 text-white transition-all shadow-sm flex-shrink-0"
        >
          <Sparkles className="w-3 h-3 text-whatsapp-light" />
          <span>Send Template</span>
        </button>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-3 flex items-end gap-2.5">
        <div className="flex-1 relative rounded-xl bg-surface-100/90 border border-white/5 focus-within:border-whatsapp-light/40 transition-all">
          <textarea
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={windowStatus.isExpired || sending || disabled}
            placeholder={
              windowStatus.isExpired
                ? "Freeform messaging locked. Use 'Send Template' button above to re-engage..."
                : "Type a message... (Press Enter to send, Shift+Enter for new line)"
            }
            className="w-full px-3.5 py-2.5 bg-transparent text-sm text-gray-100 placeholder-gray-500 resize-none focus:outline-none disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={!text.trim() || sending || windowStatus.isExpired || disabled}
          className="p-2.5 rounded-xl bg-whatsapp-light hover:brightness-110 active:scale-95 text-black font-semibold disabled:opacity-40 disabled:hover:brightness-100 transition-all shadow-glow flex-shrink-0"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";
import { MessageTemplate } from "@/types/strapi";
import { X, Send, Sparkles, AlertCircle } from "lucide-react";

interface TemplateSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: MessageTemplate[];
  recipientName: string;
  onSendTemplate: (templateName: string, language: string, variables: string[]) => void;
}

export function TemplateSelectorModal({
  isOpen,
  onClose,
  templates,
  recipientName,
  onSendTemplate,
}: TemplateSelectorModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(
    templates[0] || null
  );
  const [variables, setVariables] = useState<string[]>([recipientName || "Valued Customer"]);

  if (!isOpen) return null;

  const handleSend = () => {
    if (!selectedTemplate) return;
    onSendTemplate(selectedTemplate.name, selectedTemplate.language, variables);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[#0f141c] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-whatsapp-light" />
            <h3 className="text-base font-bold text-white">Select WhatsApp HSM Template</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-400">
            Outside the 24-hour service window, Meta Cloud API requires pre-approved Business
            Initiated Templates. Pick a template to resume conversation.
          </p>

          {/* Template List Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">Approved Templates</label>
            <div className="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto pr-1">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => {
                    setSelectedTemplate(tpl);
                    setVariables([recipientName || "Customer"]);
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedTemplate?.id === tpl.id
                      ? "bg-whatsapp/15 border-whatsapp-light text-white"
                      : "bg-white/[0.02] border-white/5 text-gray-300 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{tpl.name}</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-bold">
                      {tpl.category}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {tpl.components.find((c) => c.type === "BODY")?.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Variables Configuration */}
          {selectedTemplate && (
            <div className="p-3.5 rounded-xl bg-surface-100/80 border border-white/5 space-y-3">
              <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <span>Template Parameter {"{{1}}"} (Customer Name)</span>
              </label>
              <input
                type="text"
                value={variables[0] || ""}
                onChange={(e) => setVariables([e.target.value])}
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-whatsapp-light"
                placeholder="Recipient name"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#0a0d13] border-t border-white/5 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            className="px-5 py-2 rounded-lg text-xs font-semibold text-black bg-whatsapp-light hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 shadow-glow"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Approved Template</span>
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { X, Image, Video, FileText, MousePointerClick, Send, Loader2, Paperclip } from "lucide-react";
import {
  MAX_MEDIA_CAPTION_LENGTH,
  MAX_MEDIA_UPLOAD_BYTES,
  mediaAcceptAttribute,
  type MediaMessageType,
  validateMediaFile,
} from "@/lib/inbox/media";

export type MediaSendPayload =
  | {
      messageType: MediaMessageType;
      file: File;
      caption?: string;
      filename?: string;
    }
  | {
      messageType: "interactive";
      text: string;
      interactiveButtons: Array<{ id: string; title: string }>;
    };

interface MediaAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMedia: (payload: MediaSendPayload) => Promise<void>;
}

type Tab = MediaMessageType | "interactive";

const TABS: Array<{ id: Tab; label: string; icon: typeof Image }> = [
  { id: "image", label: "Image", icon: Image },
  { id: "video", label: "Video", icon: Video },
  { id: "document", label: "Document", icon: FileText },
  { id: "interactive", label: "CTA Buttons", icon: MousePointerClick },
];

const MAX_MB = Math.floor(MAX_MEDIA_UPLOAD_BYTES / (1024 * 1024));

export function MediaAttachmentModal({
  isOpen,
  onClose,
  onSendMedia,
}: MediaAttachmentModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("image");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [filename, setFilename] = useState("");

  // Interactive buttons
  const [interactiveBody, setInteractiveBody] = useState("Thank you for reaching out! Would you like to schedule an onboarding call?");
  const [btn1, setBtn1] = useState("Yes, Schedule Call");
  const [btn2, setBtn2] = useState("Send Pricing First");
  const [btn3, setBtn3] = useState("Talk to Human Agent");

  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setFile(null);
    setFileError(null);
  };

  const chooseFile = (picked: File | null) => {
    setFileError(null);
    setFile(null);
    if (!picked || activeTab === "interactive") return;
    const problem = validateMediaFile(picked, activeTab);
    if (problem) {
      setFileError(problem);
      return;
    }
    setFile(picked);
    if (activeTab === "document") setFilename(picked.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (activeTab === "interactive") {
        const buttons = [
          btn1 ? { id: "btn_1", title: btn1.trim() } : null,
          btn2 ? { id: "btn_2", title: btn2.trim() } : null,
          btn3 ? { id: "btn_3", title: btn3.trim() } : null,
        ].filter(Boolean) as Array<{ id: string; title: string }>;

        await onSendMedia({
          messageType: "interactive",
          text: interactiveBody.trim(),
          interactiveButtons: buttons,
        });
      } else {
        if (!file) return;
        await onSendMedia({
          messageType: activeTab,
          file,
          caption: caption.trim() || undefined,
          filename: activeTab === "document" ? filename.trim() || undefined : undefined,
        });
      }

      onClose();
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light text-xs";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-surface-100/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-whatsapp-light">
              <Paperclip className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Send Rich WhatsApp Message</h2>
              <p className="text-xs text-gray-400">Send a file from your device or interactive quick-reply buttons</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="grid grid-cols-4 border-b border-white/5 bg-black/30 p-1 text-xs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchTab(tab.id)}
                className={`py-2 flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-all ${
                  activeTab === tab.id
                    ? "bg-whatsapp/20 text-whatsapp-light border border-whatsapp/30"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {activeTab !== "interactive" && (
            <>
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  {activeTab === "image" ? "Image" : activeTab === "video" ? "Video" : "Document"} file *
                </label>
                <input
                  key={activeTab}
                  type="file"
                  required
                  accept={mediaAcceptAttribute(activeTab)}
                  onChange={(e) => chooseFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white hover:file:bg-white/20"
                />
                <p className="mt-1 text-[10px] text-gray-500">
                  Up to {MAX_MB} MB.{" "}
                  {activeTab === "image" && "JPEG or PNG."}
                  {activeTab === "video" && "MP4 or 3GP."}
                  {activeTab === "document" && "PDF, Word, Excel, PowerPoint, text or CSV."}
                </p>
                {file && <p className="mt-1 text-[10px] text-emerald-300">{file.name}</p>}
                {fileError && <p className="mt-1 text-[10px] text-red-400">{fileError}</p>}
              </div>

              {activeTab === "document" && (
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Display Filename</label>
                  <input
                    type="text"
                    maxLength={255}
                    placeholder="e.g. product_catalog.pdf"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Caption</label>
                <input
                  type="text"
                  maxLength={MAX_MEDIA_CAPTION_LENGTH}
                  placeholder="Optional caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className={inputClass}
                />
              </div>
            </>
          )}

          {activeTab === "interactive" && (
            <>
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Message Text *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter message prompting the customer to select a button..."
                  value={interactiveBody}
                  onChange={(e) => setInteractiveBody(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light text-xs leading-relaxed"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-gray-300 font-semibold">
                  Reply Buttons (Up to 3, max 20 chars each)
                </label>
                <input
                  type="text"
                  maxLength={20}
                  required
                  placeholder="Button 1 (e.g. Yes, Schedule)"
                  value={btn1}
                  onChange={(e) => setBtn1(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-whatsapp-light text-xs"
                />
                <input
                  type="text"
                  maxLength={20}
                  placeholder="Button 2 (Optional)"
                  value={btn2}
                  onChange={(e) => setBtn2(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-whatsapp-light text-xs"
                />
                <input
                  type="text"
                  maxLength={20}
                  placeholder="Button 3 (Optional)"
                  value={btn3}
                  onChange={(e) => setBtn3(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-whatsapp-light text-xs"
                />
              </div>
            </>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (activeTab !== "interactive" && !file)}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-whatsapp-light hover:brightness-110 active:scale-95 text-black font-bold transition-all shadow-glow disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send via WhatsApp</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

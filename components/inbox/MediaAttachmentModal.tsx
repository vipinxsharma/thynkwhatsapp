"use client";

import { useState } from "react";
import { X, Image, FileText, MousePointerClick, Send, Loader2, Sparkles, Paperclip } from "lucide-react";

interface MediaAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMedia: (payload: {
    messageType: "image" | "document" | "interactive";
    mediaUrl?: string;
    caption?: string;
    filename?: string;
    interactiveButtons?: Array<{ id: string; title: string }>;
    text?: string;
  }) => Promise<void>;
}

export function MediaAttachmentModal({
  isOpen,
  onClose,
  onSendMedia,
}: MediaAttachmentModalProps) {
  const [activeTab, setActiveTab] = useState<"image" | "document" | "interactive">("image");
  const [mediaUrl, setMediaUrl] = useState("https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80");
  const [caption, setCaption] = useState("Here is the updated product catalog brochure.");
  const [filename, setFilename] = useState("thynkWISE_Q4_Enterprise_Catalog.pdf");
  const [docUrl, setDocUrl] = useState("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf");
  
  // Interactive buttons
  const [interactiveBody, setInteractiveBody] = useState("Thank you for reaching out! Would you like to schedule an onboarding call?");
  const [btn1, setBtn1] = useState("Yes, Schedule Call");
  const [btn2, setBtn2] = useState("Send Pricing First");
  const [btn3, setBtn3] = useState("Talk to Human Agent");

  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (activeTab === "image") {
        await onSendMedia({
          messageType: "image",
          mediaUrl: mediaUrl.trim(),
          caption: caption.trim(),
        });
      } else if (activeTab === "document") {
        await onSendMedia({
          messageType: "document",
          mediaUrl: docUrl.trim(),
          filename: filename.trim(),
          caption: caption.trim(),
        });
      } else if (activeTab === "interactive") {
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
      }

      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-[#0e131b] border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-surface-100/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-whatsapp-light">
              <Paperclip className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Send Rich WhatsApp Message</h2>
              <p className="text-xs text-gray-400">Dispatch media assets or interactive quick-reply buttons</p>
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
        <div className="grid grid-cols-3 border-b border-white/5 bg-black/30 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("image")}
            className={`py-2 flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-all ${
              activeTab === "image"
                ? "bg-whatsapp/20 text-whatsapp-light border border-whatsapp/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Image className="w-4 h-4" />
            <span>Image</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("document")}
            className={`py-2 flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-all ${
              activeTab === "document"
                ? "bg-whatsapp/20 text-whatsapp-light border border-whatsapp/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Document / PDF</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("interactive")}
            className={`py-2 flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-all ${
              activeTab === "interactive"
                ? "bg-whatsapp/20 text-whatsapp-light border border-whatsapp/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <MousePointerClick className="w-4 h-4" />
            <span>CTA Buttons</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {activeTab === "image" && (
            <>
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Image URL *</label>
                <input
                  type="url"
                  required
                  placeholder="https://..."
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Image Caption</label>
                <input
                  type="text"
                  placeholder="Add a caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light text-xs"
                />
              </div>
            </>
          )}

          {activeTab === "document" && (
            <>
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Document URL (PDF / Doc) *</label>
                <input
                  type="url"
                  required
                  placeholder="https://.../proposal.pdf"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Display Filename</label>
                <input
                  type="text"
                  placeholder="e.g. thynkWISE_Proposal_2026.pdf"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light text-xs"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Document Caption</label>
                <input
                  type="text"
                  placeholder="Optional caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light text-xs"
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
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-whatsapp-light hover:brightness-110 active:scale-95 text-black font-bold transition-all shadow-glow disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send via Meta API</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

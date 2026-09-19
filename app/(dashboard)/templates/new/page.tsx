"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Smartphone,
  Plus,
  Send,
  HelpCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

export default function NewTemplatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">(
    "UTILITY"
  );
  const [language, setLanguage] = useState("en_US");
  const [headerType, setHeaderType] = useState<"NONE" | "TEXT" | "IMAGE">("TEXT");
  const [headerText, setHeaderText] = useState("Order Update");
  const [bodyText, setBodyText] = useState(
    "Hi {{1}}, your order #{{2}} has been confirmed and is on its way!"
  );
  const [footerText, setFooterText] = useState("thynkWISE Automated Notifications");
  const [buttonType, setButtonType] = useState<"NONE" | "QUICK_REPLY" | "URL">("QUICK_REPLY");
  const [buttonText, setButtonText] = useState("Track Shipment");
  const [buttonUrl, setButtonUrl] = useState("https://thynkwise.co.in/orders");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const addVariableToBody = () => {
    // Count existing {{n}} placeholders
    const matches = bodyText.match(/\{\{\d+\}\}/g) || [];
    const nextIndex = matches.length + 1;
    setBodyText((prev) => `${prev} {{${nextIndex}}}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !bodyText.trim()) return;

    setLoading(true);
    try {
      const components: any[] = [];

      if (headerType === "TEXT" && headerText.trim()) {
        components.push({ type: "HEADER", format: "TEXT", text: headerText });
      } else if (headerType === "IMAGE") {
        components.push({ type: "HEADER", format: "IMAGE" });
      }

      components.push({ type: "BODY", text: bodyText });

      if (footerText.trim()) {
        components.push({ type: "FOOTER", text: footerText });
      }

      if (buttonType === "QUICK_REPLY" && buttonText.trim()) {
        components.push({
          type: "BUTTONS",
          buttons: [{ type: "QUICK_REPLY", text: buttonText }],
        });
      } else if (buttonType === "URL" && buttonText.trim()) {
        components.push({
          type: "BUTTONS",
          buttons: [{ type: "URL", text: buttonText, url: buttonUrl }],
        });
      }

      const res = await fetch("/api/meta/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          language,
          components,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create template");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/templates");
      }, 1200);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 max-w-6xl">
      {/* Top Bar */}
      <div className="flex items-center gap-3 pb-6 border-b border-white/5">
        <Link
          href="/templates"
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Create WhatsApp HSM Template
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Design and submit templates directly to Meta Cloud API for automated or re-engagement messaging.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Configuration Column */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-5">
          {/* Template Details */}
          <div className="p-5 rounded-2xl bg-surface-100/60 border border-white/5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Basic Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. order_shipped_v2"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-whatsapp-light font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-whatsapp-light"
                >
                  <option value="UTILITY">UTILITY (Transactional)</option>
                  <option value="MARKETING">MARKETING (Promotional)</option>
                  <option value="AUTHENTICATION">AUTHENTICATION (OTPs)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1">Language *</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-whatsapp-light"
                >
                  <option value="en_US">English (US)</option>
                  <option value="hi_IN">Hindi (India)</option>
                  <option value="es_ES">Spanish</option>
                  <option value="pt_BR">Portuguese (Brazil)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="p-5 rounded-2xl bg-surface-100/60 border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Header</h3>
              <div className="flex gap-2 text-xs">
                {(["NONE", "TEXT", "IMAGE"] as const).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setHeaderType(t)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold capitalize transition-all ${
                      headerType === t
                        ? "bg-whatsapp/20 text-whatsapp-light border border-whatsapp/30"
                        : "bg-white/[0.02] text-gray-400 hover:bg-white/5"
                    }`}
                  >
                    {t.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {headerType === "TEXT" && (
              <input
                type="text"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="Header text title..."
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-whatsapp-light"
              />
            )}
          </div>

          {/* Body */}
          <div className="p-5 rounded-2xl bg-surface-100/60 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Body Message *
              </h3>
              <button
                type="button"
                onClick={addVariableToBody}
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-whatsapp-light transition-all border border-white/5"
              >
                <Plus className="w-3 h-3" />
                <span>Add {"{{Variable}}"}</span>
              </button>
            </div>

            <textarea
              rows={4}
              required
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Enter message text... Use {{1}}, {{2}} for dynamic customer parameters."
              className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-whatsapp-light leading-relaxed"
            />
          </div>

          {/* Footer */}
          <div className="p-5 rounded-2xl bg-surface-100/60 border border-white/5 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Footer (Optional)
            </h3>
            <input
              type="text"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="Disclaimer, company name, or reply STOP to opt-out..."
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-whatsapp-light"
            />
          </div>

          {/* Buttons */}
          <div className="p-5 rounded-2xl bg-surface-100/60 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Interactive Buttons
              </h3>
              <div className="flex gap-2 text-xs">
                {(["NONE", "QUICK_REPLY", "URL"] as const).map((b) => (
                  <button
                    type="button"
                    key={b}
                    onClick={() => setButtonType(b)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold capitalize transition-all ${
                      buttonType === b
                        ? "bg-whatsapp/20 text-whatsapp-light border border-whatsapp/30"
                        : "bg-white/[0.02] text-gray-400 hover:bg-white/5"
                    }`}
                  >
                    {b === "QUICK_REPLY" ? "Quick Reply" : b === "URL" ? "Call to Action (URL)" : "None"}
                  </button>
                ))}
              </div>
            </div>

            {buttonType !== "NONE" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-1">
                    Button Label
                  </label>
                  <input
                    type="text"
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                    placeholder="e.g. Confirm Order"
                    className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-whatsapp-light"
                  />
                </div>
                {buttonType === "URL" && (
                  <div>
                    <label className="text-xs font-medium text-gray-400 block mb-1">
                      Website URL
                    </label>
                    <input
                      type="url"
                      value={buttonUrl}
                      onChange={(e) => setButtonUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-whatsapp-light"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || success}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-whatsapp-light hover:brightness-110 active:scale-95 text-black font-bold text-xs transition-all shadow-glow disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting to Meta...</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submitted Successfully!</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Template for Meta Approval</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Real-time WhatsApp Device Preview Column */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 mb-4 text-xs font-semibold text-gray-300">
            <Smartphone className="w-4 h-4 text-whatsapp-light" />
            <span>Interactive Live WhatsApp Preview</span>
          </div>

          <div className="w-72 rounded-[36px] p-3 bg-black border-4 border-gray-800 shadow-2xl relative">
            <div className="w-24 h-4 bg-gray-900 rounded-full mx-auto mb-2" />

            <div className="rounded-[24px] overflow-hidden bg-[#0b141a] p-3 text-xs min-h-[440px] flex flex-col justify-between whatsapp-pattern">
              <div className="p-2 rounded-lg bg-[#202c33] flex items-center gap-2 text-white">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-[10px] flex items-center justify-center font-bold">
                  W
                </div>
                <div>
                  <p className="text-xs font-semibold">thynkWISE Verified</p>
                  <p className="text-[9px] text-emerald-400">Official Business Account</p>
                </div>
              </div>

              {/* Dynamic Bubble */}
              <div className="my-auto bg-[#202c33] p-3 rounded-xl text-gray-100 space-y-2 shadow-md">
                {headerType === "TEXT" && headerText && (
                  <p className="font-bold text-white text-xs border-b border-white/5 pb-1">
                    {headerText}
                  </p>
                )}
                {headerType === "IMAGE" && (
                  <div className="h-28 rounded-lg bg-surface-50 border border-white/10 flex items-center justify-center text-gray-500 text-[10px]">
                    [Image Header Asset]
                  </div>
                )}
                <p className="text-[11px] leading-relaxed text-gray-200 whitespace-pre-wrap">
                  {bodyText || "Your template body will appear here..."}
                </p>
                {footerText && (
                  <p className="text-[9px] text-gray-400 pt-1 border-t border-white/5">
                    {footerText}
                  </p>
                )}

                {buttonType !== "NONE" && buttonText && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <div className="text-center py-1.5 rounded-lg bg-[#2a3942] text-whatsapp-light font-semibold text-[10px] shadow-sm">
                      {buttonText}
                    </div>
                  </div>
                )}
              </div>

              <div className="text-center text-[10px] text-gray-500">
                End-to-end encrypted
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

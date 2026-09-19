import Link from "next/link";
import { StrapiClient } from "@/lib/strapi/client";
import { MessageTemplate } from "@/types/strapi";
import { CheckCircle2, Clock, XCircle, Plus, Sparkles, Smartphone } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const strapi = new StrapiClient();
  const templates = await strapi.getTemplates();

  const renderStatusBadge = (status: MessageTemplate["status"]) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Approved
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            Under Review
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Meta Approved Message Templates
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-whatsapp/20 text-whatsapp-light border border-whatsapp/30 font-semibold uppercase">
              HSM
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Highly Structured Messages (HSM) required to initiate conversations or message
            customers outside the 24-hour window.
          </p>
        </div>

        <Link
          href="/templates/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-whatsapp-light hover:brightness-110 active:scale-95 text-black font-semibold text-xs transition-all shadow-glow"
        >
          <Plus className="w-4 h-4" />
          <span>Submit New Template</span>
        </Link>
      </div>

      {/* Grid of Templates & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template Cards List */}
        <div className="lg:col-span-2 space-y-4">
          {templates.map((tpl) => {
            const header = tpl.components.find((c) => c.type === "HEADER");
            const body = tpl.components.find((c) => c.type === "BODY");
            const footer = tpl.components.find((c) => c.type === "FOOTER");
            const buttons = tpl.components.find((c) => c.type === "BUTTONS");

            return (
              <div
                key={tpl.id}
                className="p-5 rounded-xl bg-surface-100/60 border border-white/5 hover:border-white/10 transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base font-bold text-white font-mono">{tpl.name}</span>
                    <span className="text-xs text-gray-400">({tpl.language})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-gray-300">
                      {tpl.category}
                    </span>
                    {renderStatusBadge(tpl.status)}
                  </div>
                </div>

                {/* Content Box */}
                <div className="p-3.5 rounded-lg bg-black/40 border border-white/5 space-y-2 text-xs">
                  {header?.text && (
                    <p className="font-bold text-gray-200">{header.text}</p>
                  )}
                  <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {body?.text}
                  </p>
                  {footer?.text && (
                    <p className="text-[11px] text-gray-500">{footer.text}</p>
                  )}
                  {buttons?.buttons && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                      {buttons.buttons.map((btn, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-whatsapp-light text-[11px] font-medium"
                        >
                          {btn.text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                  <span>Meta ID: {tpl.metaTemplateId}</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Synced with Meta Cloud API
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live WhatsApp Device Simulation */}
        <div className="p-6 rounded-2xl bg-[#0e131b] border border-white/5 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-4 text-xs font-semibold text-gray-300">
            <Smartphone className="w-4 h-4 text-whatsapp-light" />
            <span>WhatsApp Mobile Preview</span>
          </div>

          {/* Phone Mockup Frame */}
          <div className="w-72 rounded-[36px] p-3 bg-black border-4 border-gray-800 shadow-2xl relative">
            {/* Camera notch */}
            <div className="w-24 h-4 bg-gray-900 rounded-full mx-auto mb-2" />

            {/* Screen */}
            <div className="rounded-[24px] overflow-hidden bg-[#0b141a] p-3 text-xs min-h-[420px] flex flex-col justify-between whatsapp-pattern">
              {/* Fake WhatsApp Header */}
              <div className="p-2 rounded-lg bg-[#202c33] flex items-center gap-2 text-white">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-[10px] flex items-center justify-center font-bold">
                  W
                </div>
                <span className="text-xs font-semibold">thynkWISE Verified</span>
              </div>

              {/* Message Bubble Preview */}
              <div className="my-auto bg-[#202c33] p-3 rounded-xl text-gray-100 space-y-1.5 shadow-md">
                <p className="font-bold text-white text-[11px]">Following up from thynkWISE</p>
                <p className="text-[11px] leading-relaxed text-gray-300">
                  Hi Aarav, our customer specialist wanted to follow up on your recent question.
                  Would you like to continue our conversation?
                </p>
                <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                  <div className="text-center py-1 rounded bg-[#2a3942] text-whatsapp-light font-medium text-[10px]">
                    Yes, continue chat
                  </div>
                  <div className="text-center py-1 rounded bg-[#2a3942] text-gray-400 font-medium text-[10px]">
                    Not right now
                  </div>
                </div>
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

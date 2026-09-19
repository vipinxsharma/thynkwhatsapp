"use client";

import { useState } from "react";
import {
  Send,
  Users,
  FileText,
  DollarSign,
  Gauge,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { sampleTemplates } from "@/lib/strapi/mock-data";

export default function CampaignsPage() {
  const [selectedTemplate, setSelectedTemplate] = useState(sampleTemplates[0].name);
  const [selectedSegment, setSelectedSegment] = useState("all");
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({
    total: 250,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
  });

  const currentTemplate =
    sampleTemplates.find((t) => t.name === selectedTemplate) || sampleTemplates[0];

  // Conversation pricing based on Meta category
  const estimatedCostPerMsg = currentTemplate.category === "MARKETING" ? 0.075 : 0.015; // in USD approx
  const totalCost = (stats.total * estimatedCostPerMsg).toFixed(2);

  const handleLaunchCampaign = () => {
    setIsSending(true);
    setProgress(0);
    setStats({ total: 250, sent: 0, delivered: 0, read: 0, failed: 0 });

    let sentCount = 0;
    const interval = setInterval(() => {
      sentCount += 25;
      const currentProgress = Math.min(100, Math.round((sentCount / 250) * 100));
      setProgress(currentProgress);

      setStats({
        total: 250,
        sent: Math.min(250, sentCount),
        delivered: Math.min(248, Math.round(sentCount * 0.98)),
        read: Math.min(210, Math.round(sentCount * 0.84)),
        failed: Math.min(2, Math.round(sentCount * 0.008)),
      });

      if (sentCount >= 250) {
        clearInterval(interval);
        setIsSending(false);
      }
    }, 400);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="pb-6 border-b border-white/5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              WhatsApp Broadcast & Campaign Engine
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-whatsapp/20 text-whatsapp-light border border-whatsapp/30 font-semibold uppercase">
              Meta Cloud API
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Execute bulk outbound campaigns using pre-approved HSM templates compliant with Meta
            messaging tiers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaign Configuration Form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Step 1: Select Template */}
          <div className="p-5 rounded-xl bg-surface-100/60 border border-white/5 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-whatsapp-light" />
              <span>1. Select Approved HSM Template</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {sampleTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl.name)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                    selectedTemplate === tpl.name
                      ? "bg-whatsapp/15 border-whatsapp-light text-white"
                      : "bg-white/[0.02] border-white/5 text-gray-300 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm font-mono">{tpl.name}</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-white/10 text-gray-300">
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

          {/* Step 2: Target Segment */}
          <div className="p-5 rounded-xl bg-surface-100/60 border border-white/5 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span>2. Choose Audience Segment</span>
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { id: "all", label: "All Contacts", count: "250 recipients" },
                { id: "leads", label: "Lead: High Intent", count: "84 recipients" },
                { id: "customers", label: "Paid Customers", count: "166 recipients" },
              ].map((seg) => (
                <div
                  key={seg.id}
                  onClick={() => setSelectedSegment(seg.id)}
                  className={`p-3 rounded-lg border cursor-pointer text-center transition-all ${
                    selectedSegment === seg.id
                      ? "bg-blue-500/20 border-blue-400 text-white"
                      : "bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/5"
                  }`}
                >
                  <p className="font-semibold text-gray-200">{seg.label}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{seg.count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Launch Trigger */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-gray-400 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-emerald-400" />
              <span>Throughput: 80 msgs/second (Meta Tier 1)</span>
            </div>

            <button
              onClick={handleLaunchCampaign}
              disabled={isSending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-whatsapp-light hover:brightness-110 active:scale-95 text-black font-bold text-xs transition-all shadow-glow disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-black border-t-transparent" />
                  <span>Broadcasting Campaign...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-black" />
                  <span>Launch WhatsApp Broadcast</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Campaign Metrics & Real-time Progress Card */}
        <div className="space-y-5">
          {/* Estimated Pricing Card */}
          <div className="p-5 rounded-xl bg-surface-100/60 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Cost Breakdown
              </span>
              <DollarSign className="w-4 h-4 text-whatsapp-light" />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Category Rate:</span>
                <span className="text-gray-200 font-mono">${estimatedCostPerMsg}/conv</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Audience Size:</span>
                <span className="text-gray-200 font-mono">{stats.total} contacts</span>
              </div>
              <div className="pt-2 border-t border-white/5 flex justify-between font-bold text-sm">
                <span className="text-white">Estimated Cost:</span>
                <span className="text-whatsapp-light font-mono">${totalCost} USD</span>
              </div>
            </div>
          </div>

          {/* Real-time Delivery Stats */}
          <div className="p-5 rounded-xl bg-surface-100/60 border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Broadcast Progress
              </span>
              <span className="text-xs font-mono font-bold text-whatsapp-light">{progress}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-gray-400">Sent</span>
                <p className="text-base font-mono font-bold text-white mt-0.5">{stats.sent}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-gray-400">Delivered</span>
                <p className="text-base font-mono font-bold text-emerald-400 mt-0.5">
                  {stats.delivered}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-gray-400">Read</span>
                <p className="text-base font-mono font-bold text-blue-400 mt-0.5">{stats.read}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-gray-400">Failed</span>
                <p className="text-base font-mono font-bold text-red-400 mt-0.5">{stats.failed}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

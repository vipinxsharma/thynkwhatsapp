"use client";

import { useState } from "react";
import {
  TrendingUp,
  BarChart3,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  MessageSquare,
  Sparkles,
  Zap,
  Phone,
  ShieldCheck,
} from "lucide-react";

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [projectedVolume, setProjectedVolume] = useState(25000);

  // Projected Meta costs based on volume
  const marketingShare = 0.45;
  const utilityShare = 0.35;
  const serviceShare = 0.20;

  const marketingCost = (projectedVolume * marketingShare * 0.075).toFixed(2);
  const utilityCost = (projectedVolume * utilityShare * 0.015).toFixed(2);
  const serviceCost = (Math.max(0, projectedVolume * serviceShare - 1000) * 0.005).toFixed(2);
  const totalProjectedCost = (
    parseFloat(marketingCost) +
    parseFloat(utilityCost) +
    parseFloat(serviceCost)
  ).toFixed(2);

  const weeklyVolume = [
    { day: "Mon", outbound: 1420, inbound: 980 },
    { day: "Tue", outbound: 1890, inbound: 1240 },
    { day: "Wed", outbound: 2340, inbound: 1510 },
    { day: "Thu", outbound: 2120, inbound: 1430 },
    { day: "Fri", outbound: 2680, inbound: 1820 },
    { day: "Sat", outbound: 1150, inbound: 820 },
    { day: "Sun", outbound: 920, inbound: 640 },
  ];

  const maxVolume = Math.max(...weeklyVolume.map((d) => d.outbound + d.inbound));

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 max-w-6xl">
      {/* Top Banner */}
      <div className="pb-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Enterprise Messaging Analytics & Meta Costs
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold uppercase">
              Real-time BI
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Meta Cloud API delivery metrics, read rates, 24-hour window compliance, and billing estimates.
          </p>
        </div>

        {/* Time Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-100/60 border border-white/5 text-xs">
          {(["7d", "30d", "90d"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                timeRange === range
                  ? "bg-whatsapp/20 text-whatsapp-light border border-whatsapp/30"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Last {range}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-surface-100/60 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Total Messages</span>
            <MessageSquare className="w-4 h-4 text-whatsapp-light" />
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">12,520</p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+18.4% vs last period</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-100/60 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Overall Delivery Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">99.82%</p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Tier 1 Meta Quality</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-100/60 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Read / Open Rate</span>
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">84.6%</p>
          <p className="text-[11px] text-gray-400">4.5x higher than email</p>
        </div>

        <div className="p-5 rounded-2xl bg-surface-100/60 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Estimated Meta Bill</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">$342.50</p>
          <p className="text-[11px] text-amber-400 font-medium">Pass-through wholesale rates</p>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Traffic Volume Bar Chart */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-surface-100/60 border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Daily Message Volume & Flow
              </h3>
              <p className="text-xs text-gray-400">Inbound customer chats vs Outbound broadcast HSMs</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-gray-300">
                <span className="w-2.5 h-2.5 rounded-full bg-whatsapp-light" />
                Outbound
              </span>
              <span className="flex items-center gap-1.5 text-gray-300">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                Inbound
              </span>
            </div>
          </div>

          {/* Bar Chart Container */}
          <div className="pt-6 pb-2">
            <div className="flex items-end justify-between gap-4 h-48 px-2 border-b border-white/5">
              {weeklyVolume.map((item) => {
                const total = item.outbound + item.inbound;
                const heightPercent = Math.round((total / maxVolume) * 100);
                const outboundPercent = Math.round((item.outbound / total) * 100);

                return (
                  <div key={item.day} className="flex-1 flex flex-col items-center gap-2 group">
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-black/90 px-2 py-1 rounded text-white border border-white/10 whitespace-nowrap shadow-lg">
                      {total.toLocaleString()} msgs
                    </div>

                    {/* Stacked bar */}
                    <div
                      className="w-full max-w-[36px] rounded-t-lg overflow-hidden flex flex-col justify-end transition-all duration-300 group-hover:brightness-110"
                      style={{ height: `${Math.max(15, heightPercent)}%` }}
                    >
                      <div
                        className="bg-whatsapp-light/90 w-full"
                        style={{ height: `${outboundPercent}%` }}
                      />
                      <div
                        className="bg-blue-500/90 w-full"
                        style={{ height: `${100 - outboundPercent}%` }}
                      />
                    </div>

                    <span className="text-[11px] font-semibold text-gray-400 mt-1">
                      {item.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Conversation Category Donut / Breakdown */}
        <div className="p-6 rounded-2xl bg-surface-100/60 border border-white/5 space-y-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Meta Conversation Categories
            </h3>
            <p className="text-xs text-gray-400">Billing tier distribution</p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-300 font-medium">Marketing (Promotional HSMs)</span>
                <span className="font-mono text-whatsapp-light font-bold">45% ($0.075)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden">
                <div className="h-full bg-whatsapp-light rounded-full" style={{ width: "45%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-300 font-medium">Utility (Order Alerts & OTPs)</span>
                <span className="font-mono text-blue-400 font-bold">35% ($0.015)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full" style={{ width: "35%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-300 font-medium">Service (User-Initiated 24h)</span>
                <span className="font-mono text-purple-400 font-bold">20% (Free 1k/mo)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden">
                <div className="h-full bg-purple-400 rounded-full" style={{ width: "20%" }} />
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-xs text-gray-400 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>First 1,000 service conversations every calendar month are free by Meta.</span>
          </div>
        </div>
      </div>

      {/* Interactive Cost Calculator & Scaler */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0e1626] to-[#0a0e14] border border-blue-500/20 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white">
              WhatsApp Scaling & Budget Simulator
            </h3>
            <p className="text-xs text-gray-300">
              Project wholesale Meta Cloud API fees based on your target broadcast volume.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-whatsapp-light px-3 py-1 rounded-full bg-whatsapp/15 border border-whatsapp/30">
            {projectedVolume.toLocaleString()} conversations/month
          </span>
        </div>

        <input
          type="range"
          min="1000"
          max="200000"
          step="1000"
          value={projectedVolume}
          onChange={(e) => setProjectedVolume(parseInt(e.target.value, 10))}
          className="w-full accent-emerald-400 cursor-pointer h-2 bg-black/50 rounded-lg"
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 text-xs">
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
            <span className="text-gray-400">Marketing Conversations</span>
            <p className="text-lg font-mono font-bold text-white mt-1">
              ${marketingCost}
            </p>
            <p className="text-[10px] text-gray-500">{(projectedVolume * 0.45).toLocaleString()} msgs</p>
          </div>

          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
            <span className="text-gray-400">Utility Conversations</span>
            <p className="text-lg font-mono font-bold text-white mt-1">
              ${utilityCost}
            </p>
            <p className="text-[10px] text-gray-500">{(projectedVolume * 0.35).toLocaleString()} msgs</p>
          </div>

          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
            <span className="text-gray-400">Service Conversations</span>
            <p className="text-lg font-mono font-bold text-white mt-1">
              ${serviceCost}
            </p>
            <p className="text-[10px] text-gray-500">First 1,000 free</p>
          </div>

          <div className="p-3.5 rounded-xl bg-whatsapp-light/10 border border-whatsapp-light/30">
            <span className="text-whatsapp-light font-bold">Total Estimated Cost</span>
            <p className="text-2xl font-mono font-extrabold text-white mt-0.5">
              ${totalProjectedCost}
            </p>
            <p className="text-[10px] text-gray-400">Wholesale Meta billing</p>
          </div>
        </div>
      </div>
    </div>
  );
}

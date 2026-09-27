"use client";

import { useState, useEffect } from "react";
import {
  Bot,
  Zap,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Edit,
  Tag,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Loader2,
  X,
} from "lucide-react";
import { AutomationRule } from "@/lib/automations/rules";

export default function AutomationsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Live Test Playground state
  const [testInput, setTestInput] = useState("Hi, what is your pricing for enterprise?");
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testing, setTesting] = useState(false);

  // Create rule modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<"contains_keyword" | "exact_match" | "regex">(
    "contains_keyword"
  );
  const [keywordsInput, setKeywordsInput] = useState("");
  const [responseType, setResponseType] = useState<"text" | "interactive">("text");
  const [replyText, setReplyText] = useState("");
  const [tagsInput, setTagsInput] = useState("Inbound Lead");
  const [submitting, setSubmitting] = useState(false);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/automations");
      if (res.ok) {
        const json = await res.json();
        setRules(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleTestRule = async () => {
    if (!testInput.trim()) return;
    setTesting(true);
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", text: testInput }),
      });
      const json = await res.json();
      setTestResult(json);
    } finally {
      setTesting(false);
    }
  };

  const handleToggleRule = async (id: string) => {
    try {
      const res = await fetch("/api/automations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, toggle: true }),
      });
      if (res.ok) {
        setRules((prev) =>
          prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
        );
      }
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Delete this automation rule?")) return;
    try {
      const res = await fetch(`/api/automations?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !replyText.trim() || !keywordsInput.trim()) return;

    setSubmitting(true);
    try {
      const keywords = keywordsInput
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      const assignTags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          triggerType,
          keywords,
          responseType,
          replyText: replyText.trim(),
          assignTags,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setRules((prev) => [json.data, ...prev]);
        setIsModalOpen(false);
        // Reset form
        setName("");
        setDescription("");
        setKeywordsInput("");
        setReplyText("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const totalTriggers = rules.reduce((acc, r) => acc + (r.triggerCount || 0), 0);
  const activeCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 max-w-6xl">
      {/* Top Banner */}
      <div className="pb-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Automated Bot & Keyword Triggers
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold uppercase">
              24/7 Active
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Configure instant WhatsApp AI / keyword auto-responders, auto-tagging, and triage flows.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-whatsapp-light hover:brightness-110 active:scale-95 text-black font-semibold text-xs transition-all shadow-glow"
        >
          <Plus className="w-4 h-4" />
          <span>New Automation Rule</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-surface-100/60 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Active Rules</span>
            <Bot className="w-4 h-4 text-whatsapp-light" />
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">{activeCount}</p>
          <p className="text-[11px] text-gray-400">{rules.length} total configured</p>
        </div>

        <div className="p-5 rounded-2xl bg-surface-100/60 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Automated Responses Sent</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">{totalTriggers}</p>
          <p className="text-[11px] text-amber-400 font-medium">Zero human latency</p>
        </div>

        <div className="p-5 rounded-2xl bg-surface-100/60 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Bot Response SLA</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">&lt; 850ms</p>
          <p className="text-[11px] text-emerald-400 font-medium">Meta Webhook Synchronous</p>
        </div>

        <div className="p-5 rounded-2xl bg-surface-100/60 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Customer Resolution</span>
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">68.4%</p>
          <p className="text-[11px] text-blue-400 font-medium">Instant answer without agent</p>
        </div>
      </div>

      {/* Live Rule Tester Playground */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0c141f] to-[#0a0e14] border border-blue-500/20 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-blue-400 fill-blue-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Interactive Keyword & Bot Simulator
            </h2>
          </div>
          <span className="text-[11px] text-gray-400">Test how incoming WhatsApp chats match your rules</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="Type a sample customer WhatsApp message..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 text-xs"
          />
          <button
            onClick={handleTestRule}
            disabled={testing}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs transition-all shadow-glow disabled:opacity-50"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Simulate Trigger</span>
              </>
            )}
          </button>
        </div>

        {/* Test Result Display */}
        {testResult && (
          <div className="p-4 rounded-xl bg-black/50 border border-white/10 text-xs space-y-2 animate-in fade-in duration-150">
            {testResult.matched ? (
              <div>
                <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Rule Matched: &quot;{testResult.rule?.name}&quot;</span>
                </div>
                <div className="p-3 rounded-lg bg-[#202c33] text-gray-200 border border-white/5 space-y-2">
                  <p className="text-[11px] text-gray-400 font-medium">Automated WhatsApp Response:</p>
                  <p className="leading-relaxed">{testResult.rule?.replyText}</p>
                  {testResult.rule?.interactiveButtons && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                      {testResult.rule.interactiveButtons.map((btn: any) => (
                        <span
                          key={btn.id}
                          className="px-2.5 py-1 rounded bg-[#2a3942] text-whatsapp-light font-medium text-[11px]"
                        >
                          {btn.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {testResult.rule?.assignTags?.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-2">
                    Auto-assigned Tags:{" "}
                    <span className="text-white font-semibold">
                      {testResult.rule.assignTags.join(", ")}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-400 font-medium">
                <AlertCircle className="w-4 h-4" />
                <span>No rule matched this message. It will route directly to human agents in the CRM Inbox.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
          Configured Automation Rules ({rules.length})
        </h3>

        <div className="grid grid-cols-1 gap-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`p-5 rounded-2xl border transition-all ${
                rule.enabled
                  ? "bg-surface-100/60 border-white/5 hover:border-white/10"
                  : "bg-surface-100/20 border-white/5 opacity-60"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white text-base">{rule.name}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-gray-300">
                      {rule.triggerType.replace("_", " ")}
                    </span>
                    <span className="text-xs text-gray-400">
                      Triggered {rule.triggerCount || 0} times
                    </span>
                  </div>

                  <p className="text-xs text-gray-400">{rule.description}</p>

                  {/* Keywords */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[11px] text-gray-500 font-medium">Keywords:</span>
                    {rule.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[11px] font-mono"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>

                  {/* Reply message preview */}
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-xs text-gray-300 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">
                      Auto-Reply Content
                    </span>
                    <p className="leading-relaxed">{rule.replyText}</p>
                    {rule.interactiveButtons && rule.interactiveButtons.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {rule.interactiveButtons.map((btn) => (
                          <span
                            key={btn.id}
                            className="px-2 py-0.5 rounded bg-white/10 text-whatsapp-light text-[10px] font-medium"
                          >
                            {btn.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {rule.assignTags && rule.assignTags.length > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-gray-400">
                      <Tag className="w-3.5 h-3.5 text-gray-500" />
                      <span>Assigns tags:</span>
                      <span className="text-gray-200 font-medium">
                        {rule.assignTags.join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleRule(rule.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white transition-colors"
                    title={rule.enabled ? "Disable Rule" : "Enable Rule"}
                  >
                    {rule.enabled ? (
                      <ToggleRight className="w-6 h-6 text-whatsapp-light" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-gray-600" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                    title="Delete rule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl bg-[#0e131b] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-surface-100/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-whatsapp/20 border border-whatsapp/30 flex items-center justify-center text-whatsapp-light">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Create Automation Rule
                  </h2>
                  <p className="text-xs text-gray-400">Trigger instant replies based on inbound chats</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Discount Trigger"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light text-xs"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Short note about what this rule accomplishes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Matching Method</label>
                  <select
                    value={triggerType}
                    onChange={(e) => setTriggerType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-whatsapp-light text-xs"
                  >
                    <option value="contains_keyword">Contains Keyword</option>
                    <option value="exact_match">Exact Match</option>
                    <option value="regex">Regular Expression</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Response Type</label>
                  <select
                    value={responseType}
                    onChange={(e) => setResponseType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-whatsapp-light text-xs"
                  >
                    <option value="text">Plain Text</option>
                    <option value="interactive">Interactive Quick Reply Buttons</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Trigger Keywords (comma separated) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. discount, coupon, promo, deal"
                  value={keywordsInput}
                  onChange={(e) => setKeywordsInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white font-mono placeholder-gray-500 focus:outline-none focus:border-whatsapp-light text-xs"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Automated Reply Message *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter the WhatsApp response text to dispatch..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light text-xs leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Auto-Assign CRM Tags</label>
                <input
                  type="text"
                  placeholder="e.g. Promo Lead, Discount Used"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whatsapp-light text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-whatsapp-light hover:brightness-110 active:scale-95 text-black font-bold transition-all shadow-glow disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Save Automation Rule</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import type { AssistDraft, AssistResult } from "@/lib/templates/assist";

/**
 * Reviews the draft before submission, or suggests a fix for a rejected one. Changes
 * are applied only when the user chooses them; nothing is submitted here.
 */
export function TemplateAssistant({
  draft,
  onApply,
}: {
  draft: AssistDraft;
  onApply: (changes: { headerText?: string; bodyText?: string; footerText?: string; category?: AssistDraft["category"] }) => void;
}) {
  const [rejection, setRejection] = useState("");
  const [result, setResult] = useState<AssistResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/templates/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, rejectionReason: rejection.trim() || undefined }),
      });
      const payload = (await response.json().catch(() => null)) as { data?: AssistResult; error?: string } | null;
      if (!response.ok || !payload?.data) throw new Error(payload?.error || "The helper could not review this draft.");
      setResult(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The helper could not review this draft.");
    } finally {
      setLoading(false);
    }
  }

  const errors = result?.issues.filter((item) => item.severity === "error") ?? [];
  const warnings = result?.issues.filter((item) => item.severity === "warning") ?? [];
  const suggestion = result?.suggestion;

  return (
    <section aria-label="Template helper" className="p-5 rounded-2xl bg-surface-100/60 border border-white/5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-whatsapp" aria-hidden="true" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">AI template helper</h3>
      </div>
      <p className="text-xs text-gray-400">
        Checks the category and likely rejection causes. Nothing is submitted until you press Submit.
      </p>

      <label className="block text-xs font-medium text-gray-300">
        Rejected by Meta? Paste the reason here to get a fix
        <textarea
          value={rejection}
          onChange={(event) => setRejection(event.target.value)}
          rows={2}
          maxLength={1000}
          className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white"
          placeholder="e.g. Template contains promotional content"
        />
      </label>

      <button
        type="button"
        onClick={review}
        disabled={loading || !draft.bodyText.trim()}
        className="inline-flex items-center gap-2 rounded-lg bg-whatsapp px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
        {loading ? "Reviewing…" : rejection.trim() ? "Suggest a fix" : "Check this template"}
      </button>

      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}

      {result && (
        <div className="space-y-3 text-sm text-gray-200">
          <p>
            Suggested category:{" "}
            <button
              type="button"
              onClick={() => onApply({ category: result.suggestedCategory })}
              className="font-semibold text-whatsapp underline"
            >
              {result.suggestedCategory}
            </button>
          </p>
          <ul className="list-disc pl-5 text-xs text-gray-300 space-y-1">
            {result.categoryReasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>

          {errors.length > 0 && (
            <div>
              <p className="text-xs font-bold text-red-300">Fix before submitting</p>
              <ul className="list-disc pl-5 text-xs text-red-200 space-y-1">
                {errors.map((item) => <li key={item.message}>{item.message}</li>)}
              </ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div>
              <p className="text-xs font-bold text-amber-200">Check</p>
              <ul className="list-disc pl-5 text-xs text-amber-100 space-y-1">
                {warnings.map((item) => <li key={item.message}>{item.message}</li>)}
              </ul>
            </div>
          )}

          {suggestion?.fixNotes && suggestion.fixNotes.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-300">How to fix</p>
              <ul className="list-disc pl-5 text-xs text-gray-300 space-y-1">
                {suggestion.fixNotes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            </div>
          )}

          {(suggestion?.bodyText || suggestion?.headerText || suggestion?.footerText) && (
            <div className="rounded-lg border border-white/10 p-3 space-y-2">
              <p className="text-xs font-bold text-gray-300">Suggested wording</p>
              {suggestion.headerText && <p className="text-xs"><span className="text-gray-400">Header:</span> {suggestion.headerText}</p>}
              {suggestion.bodyText && <p className="text-xs"><span className="text-gray-400">Body:</span> {suggestion.bodyText}</p>}
              {suggestion.footerText && <p className="text-xs"><span className="text-gray-400">Footer:</span> {suggestion.footerText}</p>}
              <button
                type="button"
                onClick={() => onApply({ headerText: suggestion.headerText, bodyText: suggestion.bodyText, footerText: suggestion.footerText })}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-200 hover:border-white/30"
              >
                Use this wording
              </button>
            </div>
          )}

          <p className="text-[11px] text-gray-500">
            Checked by: {result.source === "rules" ? "built-in rules" : result.source === "openai" ? "OpenAI" : "Claude"}
          </p>
        </div>
      )}
    </section>
  );
}

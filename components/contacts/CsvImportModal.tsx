"use client";

import { useState } from "react";
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Download,
} from "lucide-react";
import {
  SAMPLE_CONTACTS_CSV,
  buildImportPlan,
  guessColumnMapping,
  parseCsv,
  validateColumnMapping,
  type ColumnMapping,
  type ColumnTarget,
  type ImportPlan,
  type ParsedCsv,
} from "@/lib/contacts/csv";
import { useContactMeta } from "./contact-meta";

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

type Step = "upload" | "map" | "preview";
type ImportResult = { created: number; skipped: number; errors: string[] };

const CHUNK_SIZE = 100;
const selectClass =
  "w-full px-2.5 py-2 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-whatsapp-light transition-all text-xs";

/** Select values: "ignore", "name", "phone", "country_code", "group", "tags" or "attr:<key>". */
function tokenOf(target: ColumnTarget): string {
  return target.kind === "attribute" ? `attr:${target.key}` : target.kind;
}

function targetOf(token: string): ColumnTarget {
  if (token.startsWith("attr:")) return { kind: "attribute", key: token.slice(5) };
  return { kind: token as Exclude<ColumnTarget["kind"], "attribute"> };
}

export function CsvImportModal({ isOpen, onClose, onImportComplete }: CsvImportModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [csv, setCsv] = useState<ParsedCsv>({ headers: [], rows: [] });
  const [mapping, setMapping] = useState<ColumnMapping>([]);
  const [targetGroupId, setTargetGroupId] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const { groups, fields, metaError } = useContactMeta(isOpen);

  if (!isOpen) return null;

  const reset = () => {
    setStep("upload");
    setCsv({ headers: [], rows: [] });
    setMapping([]);
    setTargetGroupId("");
    setPlan(null);
    setResult(null);
    setError("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const parsed = parseCsv((event.target?.result as string) || "");
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setError("The file needs a header row and at least one contact row.");
        return;
      }
      setError("");
      setCsv(parsed);
      setMapping(guessColumnMapping(parsed.headers, fields));
      setStep("map");
    };
    reader.readAsText(file);
  };

  const downloadSampleTemplate = () => {
    const blob = new Blob([SAMPLE_CONTACTS_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "xeccel_contacts_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const mappingError = (() => {
    const check = validateColumnMapping(mapping);
    return check.ok ? "" : check.error;
  })();

  const goToPreview = () => {
    if (mappingError) {
      setError(mappingError);
      return;
    }
    setError("");
    setPlan(buildImportPlan(mapping, csv.rows));
    setStep("preview");
  };

  const updateColumn = (index: number, token: string) => {
    setMapping((current) => current.map((target, i) => (i === index ? targetOf(token) : target)));
  };

  const handleImport = async () => {
    if (!plan || plan.rows.length === 0) return;

    setLoading(true);
    setError("");
    const total: ImportResult = { created: 0, skipped: 0, errors: [] };
    try {
      for (let start = 0; start < plan.rows.length; start += CHUNK_SIZE) {
        const chunk = plan.rows.slice(start, start + CHUNK_SIZE);
        const res = await fetch("/api/contacts/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contacts: chunk.map((row) => ({
              name: row.name,
              phoneNumber: row.phoneNumber,
              tags: row.tags,
              customAttributes: row.customAttributes,
              ...(row.groupName ? { groupName: row.groupName } : {}),
            })),
            ...(targetGroupId ? { groupId: targetGroupId } : {}),
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to import contacts");
        }
        total.created += json.data.created;
        total.skipped += json.data.skipped;
        for (const item of json.data.errors || []) {
          const line = chunk[item.row - 1]?.line;
          total.errors.push(`Line ${line ?? "?"}: ${item.message}`);
        }
        for (const warning of json.data.warnings || []) total.errors.push(warning);
      }
      setResult(total);
      if (total.errors.length === 0) {
        setTimeout(() => {
          onImportComplete();
          close();
        }, 1500);
      } else {
        onImportComplete();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stepLabel = step === "upload" ? "1 of 3: Choose file" : step === "map" ? "2 of 3: Map columns" : "3 of 3: Review";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl bg-[var(--surface)] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-surface-100/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Bulk Import Contacts (CSV)</h2>
              <p className="text-xs text-gray-400">{stepLabel}</p>
            </div>
          </div>
          <button
            onClick={close}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {(error || metaError) && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error || metaError}</span>
            </div>
          )}

          {result && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>
                  Imported {result.created} contacts successfully! ({result.skipped} skipped)
                </span>
              </div>
              {result.errors.length > 0 && (
                <ul className="list-disc pl-5 text-amber-300 max-h-32 overflow-y-auto">
                  {result.errors.slice(0, 50).map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === "upload" && (
            <>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                <span className="text-gray-400">Need an example file to start from?</span>
                <button
                  onClick={downloadSampleTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 hover:bg-surface-50 text-gray-200 border border-white/10 font-semibold transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-whatsapp-light" />
                  <span>Download Sample CSV</span>
                </button>
              </div>

              <div className="p-6 rounded-xl border-2 border-dashed border-white/10 hover:border-whatsapp-light/40 bg-black/30 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative">
                <UploadCloud className="w-8 h-8 text-whatsapp-light mb-2" />
                <p className="text-sm font-semibold text-gray-200">Drag and drop CSV file or click to browse</p>
                <p className="text-[11px] text-gray-500 mt-1">
                  The first row must be column headers. You map the columns in the next step.
                </p>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </>
          )}

          {step === "map" && (
            <>
              <p className="text-gray-400">
                Choose what each column holds. Unmapped columns are ignored. Other columns become custom attributes on
                each contact, and columns that match a custom field use its type.
              </p>

              <div className="rounded-lg border border-white/5 bg-black/40 overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-white/5 text-gray-400 font-semibold">
                    <tr>
                      <th className="p-2 w-2/5">CSV column</th>
                      <th className="p-2">Maps to</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {csv.headers.map((header, index) => {
                      const current = tokenOf(mapping[index] || { kind: "ignore" });
                      const attributeKey = mapping[index]?.kind === "attribute" ? mapping[index].key : "";
                      return (
                        <tr key={`${header}-${index}`}>
                          <td className="p-2 text-gray-200">
                            <span className="font-medium">{header || `Column ${index + 1}`}</span>
                            {csv.rows[0]?.[index] && (
                              <span className="block text-gray-500 truncate max-w-[16rem]">e.g. {csv.rows[0][index]}</span>
                            )}
                          </td>
                          <td className="p-2">
                            <select value={current} onChange={(e) => updateColumn(index, e.target.value)} className={selectClass}>
                              <option value="ignore">Ignore this column</option>
                              <option value="phone">Phone number</option>
                              <option value="name">Contact name</option>
                              <option value="country_code">Country code</option>
                              <option value="group">Group name</option>
                              <option value="tags">Tags (separate with ;)</option>
                              <option value="attr:company">Company</option>
                              {fields.map((field) => (
                                <option key={field.key} value={`attr:${field.key}`}>
                                  Custom field: {field.label}
                                </option>
                              ))}
                              {attributeKey &&
                                !fields.some((field) => field.key === attributeKey) &&
                                attributeKey !== "company" && (
                                  <option value={`attr:${attributeKey}`}>Attribute: {attributeKey}</option>
                                )}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Add every imported contact to a group</label>
                <select value={targetGroupId} onChange={(e) => setTargetGroupId(e.target.value)} className={selectClass}>
                  <option value="">No group</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  Group names from a &ldquo;Group name&rdquo; column are matched to existing groups or create new ones.
                </p>
              </div>

              {mappingError && <p className="text-amber-300">{mappingError}</p>}
            </>
          )}

          {step === "preview" && plan && (
            <>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-300">
                  Ready to import ({plan.rows.length} of {csv.rows.length} rows)
                </span>
                {plan.errors.length > 0 && (
                  <span className="text-[11px] text-amber-300 font-semibold">{plan.errors.length} rows need attention</span>
                )}
              </div>

              <div className="rounded-lg border border-white/5 bg-black/40 overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-white/5 text-gray-400 font-semibold">
                    <tr>
                      <th className="p-2">Name</th>
                      <th className="p-2">Phone</th>
                      <th className="p-2">Group</th>
                      <th className="p-2">Attributes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {plan.rows.slice(0, 10).map((row) => (
                      <tr key={row.line} className="hover:bg-white/[0.02]">
                        <td className="p-2 font-medium text-white">{row.name}</td>
                        <td className="p-2 font-mono text-gray-300">{row.phoneNumber}</td>
                        <td className="p-2 text-gray-400">{row.groupName || "—"}</td>
                        <td className="p-2 text-gray-400">
                          {Object.entries(row.customAttributes)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(", ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {plan.rows.length > 10 && (
                <p className="text-[10px] text-gray-500 text-center">+ {plan.rows.length - 10} more rows</p>
              )}

              {plan.errors.length > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="font-semibold text-amber-300 mb-1">These rows will be skipped:</p>
                  <ul className="list-disc pl-5 text-amber-200 max-h-32 overflow-y-auto">
                    {plan.errors.slice(0, 50).map((item) => (
                      <li key={item.line}>
                        Line {item.line}: {item.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between gap-3 bg-surface-100/40">
          <div>
            {step !== "upload" && !result && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setStep(step === "preview" ? "map" : "upload");
                }}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 font-semibold transition-all"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={close}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 font-semibold transition-all"
            >
              {result ? "Close" : "Cancel"}
            </button>
            {step === "map" && (
              <button
                type="button"
                onClick={goToPreview}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-whatsapp-light hover:brightness-110 active:scale-95 text-black font-bold transition-all shadow-glow"
              >
                Review import
              </button>
            )}
            {step === "preview" && (
              <button
                type="button"
                onClick={handleImport}
                disabled={!plan || plan.rows.length === 0 || loading || !!result}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-whatsapp-light hover:brightness-110 active:scale-95 text-black font-bold transition-all shadow-glow disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Import {plan?.rows.length ?? 0} Contacts</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

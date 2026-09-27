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

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export function CsvImportModal({ isOpen, onClose, onImportComplete }: CsvImportModalProps) {
  const [csvContent, setCsvContent] = useState("");
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const parseCsv = (text: string) => {
    setError("");
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      setParsedRows([]);
      return;
    }

    const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/['"]/g, ""));
    const nameIdx = header.findIndex((h) => h.includes("name"));
    const phoneIdx = header.findIndex((h) => h.includes("phone") || h.includes("mobile") || h.includes("wa"));
    const companyIdx = header.findIndex((h) => h.includes("company") || h.includes("org"));
    const tagsIdx = header.findIndex((h) => h.includes("tag"));

    if (nameIdx === -1 || phoneIdx === -1) {
      setError("CSV must contain at least 'name' and 'phoneNumber' columns.");
      return;
    }

    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
      const name = parts[nameIdx] || "";
      const rawPhone = parts[phoneIdx] || "";
      const company = companyIdx !== -1 ? parts[companyIdx] || "" : "";
      const rawTags = tagsIdx !== -1 ? parts[tagsIdx] || "" : "";

      if (name && rawPhone) {
        rows.push({
          name,
          phoneNumber: rawPhone.startsWith("+") ? rawPhone : `+${rawPhone.replace(/\D/g, "")}`,
          company,
          tags: rawTags ? rawTags.split(";").map((t) => t.trim()) : ["Imported CSV"],
        });
      }
    }

    setParsedRows(rows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      parseCsv(content);
    };
    reader.readAsText(file);
  };

  const downloadSampleTemplate = () => {
    const sample = `name,phoneNumber,company,tags
Rajesh Kumar,+919811122233,Tata Motors,Enterprise;Automotive
Elena Rostova,+14155551212,Apex Global,Fintech;Growth
Ananya Sen,+919922233344,CloudScale,VIP Customer`;

    const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "thynkwise_contacts_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: parsedRows }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to import contacts");
      }

      setResult(json.data);
      setTimeout(() => {
        onImportComplete();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl bg-[#0e131b] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-surface-100/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Bulk Import Contacts (CSV)
              </h2>
              <p className="text-xs text-gray-400">
                Upload customer list for WhatsApp broadcasts & CRM sync
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>
                Imported {result.created} contacts successfully! ({result.skipped} skipped)
              </span>
            </div>
          )}

          {/* Sample Download Prompt */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <span className="text-gray-400">Need the standardized CSV schema?</span>
            <button
              onClick={downloadSampleTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 hover:bg-surface-50 text-gray-200 border border-white/10 font-semibold transition-all"
            >
              <Download className="w-3.5 h-3.5 text-whatsapp-light" />
              <span>Download Sample CSV</span>
            </button>
          </div>

          {/* Upload Drag & Drop / File Input */}
          <div className="p-6 rounded-xl border-2 border-dashed border-white/10 hover:border-whatsapp-light/40 bg-black/30 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative">
            <UploadCloud className="w-8 h-8 text-whatsapp-light mb-2" />
            <p className="text-sm font-semibold text-gray-200">
              Drag and drop CSV file or click to browse
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              Supports .csv with headers: name, phoneNumber, company, tags
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>

          {/* Parsed Rows Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-300">
                  Ready to Import ({parsedRows.length} valid contacts)
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold">
                  Columns matched
                </span>
              </div>

              <div className="rounded-lg border border-white/5 bg-black/40 overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-white/5 text-gray-400 font-semibold">
                    <tr>
                      <th className="p-2">Name</th>
                      <th className="p-2">Phone</th>
                      <th className="p-2">Company</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {parsedRows.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="p-2 font-medium text-white">{row.name}</td>
                        <td className="p-2 font-mono text-gray-300">{row.phoneNumber}</td>
                        <td className="p-2 text-gray-400">{row.company || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 10 && (
                <p className="text-[10px] text-gray-500 text-center">
                  + {parsedRows.length - 10} more rows
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-end gap-3 bg-surface-100/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={parsedRows.length === 0 || loading || !!result}
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
                <span>Import {parsedRows.length} Contacts</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

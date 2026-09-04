"use client";

import { useState, useRef } from "react";
import { X, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { API_V1, apiFetch } from "../../../../lib/api";
import { useAuthStore } from "../../../../store/authStore";
import { useToast } from "../../../../components/Toast";

interface CSVImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CSVImportModal({ onClose, onSuccess }: CSVImportModalProps) {
  const { token } = useAuthStore();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith(".csv")) {
        setFile(droppedFile);
      } else {
        showToast("Please upload a valid .csv file", "error");
      }
    }
  };

  const handleDownloadTemplate = () => {
    window.open(`${API_V1}/students/csv-template`, "_blank");
    showToast("Sample CSV template downloaded!", "success");
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      showToast("Please select a CSV file to import", "error");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiFetch("/students/import", {
        method: "POST",
        token,
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        showToast(`Successfully imported roster! Authorization emails queued.`, "success");
        onSuccess();
        onClose();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Failed to process CSV roster", "error");
      }
    } catch {
      showToast("Network error during roster upload", "error");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] rounded-xl border border-[#C84B18]/20">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">
                Upload Student Roster (Excel / CSV)
              </h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                Bulk enroll students and automatically dispatch authorization invites.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#716D67] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Download Template Banner */}
        <div className="bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-3.5 flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-[#242321] dark:text-[#F5F5F4]">
              Need the standardized CSV format?
            </div>
            <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">
              Includes headers: <code className="font-mono text-[#C84B18]">full_name, email, roll_number, division, batch</code>
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3 py-1.5 rounded-lg border border-[#E5E0D8] dark:border-[#292524] bg-white dark:bg-[#1D1B19] text-xs font-semibold text-[#C84B18] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] flex items-center gap-1.5 transition-all shadow-xs shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Sample Template</span>
          </button>
        </div>

        {/* Drag & Drop Upload Zone */}
        <form onSubmit={handleUpload} className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              isDragOver
                ? "border-[#C84B18] bg-[#C84B18]/5"
                : file
                ? "border-emerald-400 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20"
                : "border-[#E5E0D8] dark:border-[#292524] hover:border-[#C84B18]/60 bg-[#F7F4EF]/50 dark:bg-[#141312]/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, .xlsx, .xls, .tsv, .txt, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileChange}
              className="hidden"
            />

            {file ? (
              <div className="space-y-1.5">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <div className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4]">{file.name}</div>
                <div className="text-[11px] text-[#716D67]">
                  {(file.size / 1024).toFixed(1)} KB • Click to change file
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 text-[#716D67] mx-auto" />
                <div className="text-xs font-semibold text-[#242321] dark:text-[#F5F5F4]">
                  Drag & drop your roster <code className="font-mono text-[#C84B18]">.xlsx / .csv</code> file here
                </div>
                <div className="text-[11px] text-[#716D67]">or click to browse from your device</div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E5E0D8] dark:border-[#292524]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-xs font-semibold text-[#716D67] hover:text-[#242321] dark:hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || isUploading}
              className="btn-primary py-2 px-5 text-xs font-bold flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              <span>Import & Enroll</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

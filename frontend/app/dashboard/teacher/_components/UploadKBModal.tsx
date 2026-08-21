"use client";

import { useState, useRef } from "react";
import { X, UploadCloud, FileText, Loader2, CheckCircle2, BookOpen, Layers } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface UploadKBModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  onUploaded: (subjectId: string, fileName: string) => void;
  availableSubjects?: any[];
}

export default function UploadKBModal({
  isOpen,
  onClose,
  token,
  onUploaded,
  availableSubjects = [],
}: UploadKBModalProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const maxSizeBytes = 25 * 1024 * 1024; // 25 MB
    if (selectedFile.size > maxSizeBytes) {
      showToast("File size exceeds 25MB limit. Please choose a smaller file.", "error");
      return;
    }
    setFile(selectedFile);

    // Auto-suggest subject name if empty
    if (!subjectId) {
      const cleanName = selectedFile.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      setSubjectId(cleanName.slice(0, 30));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      showToast("Please select a document to upload.", "error");
      return;
    }
    if (!subjectId.trim()) {
      showToast("Please specify a subject domain for this document.", "error");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("subject_id", subjectId.trim());

      const res = await apiFetch("/kb/upload", {
        token,
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        showToast(`Document "${file.name}" successfully indexed into Knowledge Base!`, "success");
        onUploaded(subjectId.trim(), file.name);
        setFile(null);
        setSubjectId("");
        onClose();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.detail || "Upload failed. Please check the file format.", "error");
      }
    } catch {
      showToast("Upload network error. Please verify backend connection.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-[#171615] rounded-2xl border border-[#E5E0D8] dark:border-[#292524] p-6 max-w-lg w-full shadow-2xl space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] rounded-xl">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#242321] dark:text-[#F5F5F4]">Upload New Knowledge Base Document</h3>
              <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">Embed course notes or textbooks into Vector Store</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#716D67] hover:text-[#242321] dark:hover:text-white p-1 rounded-lg hover:bg-[#F0ECE4]/50 dark:hover:bg-[#292524] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          {/* Subject / Domain Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#57534E] dark:text-[#A8A29E] uppercase tracking-wider">
              Subject / Knowledge Domain <span className="text-[#C84B18]">*</span>
            </label>
            <input
              type="text"
              required
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              placeholder="e.g. Physics_Unit_2 or Machine_Learning"
              list="existing-subjects-datalist"
              className="w-full bg-[#FBF9F5] dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] rounded-xl px-3.5 py-2.5 text-xs text-[#242321] dark:text-[#F5F5F4] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#C84B18]/30 focus:border-[#C84B18]"
            />
            {availableSubjects.length > 0 && (
              <datalist id="existing-subjects-datalist">
                {availableSubjects.map((s: any) => (
                  <option key={s.subject_id || s.name} value={s.subject_id || s.name} />
                ))}
              </datalist>
            )}
            <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">
              Type a new subject name or pick an existing subject domain to group documents.
            </p>
          </div>

          {/* Drag & Drop File Zone */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#57534E] dark:text-[#A8A29E] uppercase tracking-wider">
              Source Document File <span className="text-[#C84B18]">*</span>
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-[#C84B18] bg-[#C84B18]/5"
                  : file
                  ? "border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/10"
                  : "border-[#E5E0D8] dark:border-[#292524] hover:border-[#C84B18]/60 bg-[#FBF9F5]/60 dark:bg-[#1D1B19]/60"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.docx,.pptx,.md"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    validateAndSetFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {file ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#171615] border border-emerald-500/30">
                  <div className="flex items-center gap-2.5 text-left truncate">
                    <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4] truncate">{file.name}</div>
                      <div className="text-[10px] text-[#716D67]">{formatFileSize(file.size)}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 py-2">
                  <UploadCloud className="h-8 w-8 text-[#C84B18] mx-auto" />
                  <div className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4]">
                    Click to browse or drop file here
                  </div>
                  <div className="text-[10px] text-[#716D67] dark:text-[#A8A29E]">
                    Supports PDF, DOCX, TXT, PPTX, MD (Max: 25MB)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="flex-1 py-2.5 rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-xs font-bold text-[#716D67] hover:bg-[#F0ECE4]/50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !file}
              className="flex-1 py-2.5 bg-[#C84B18] hover:bg-[#B33E0F] dark:bg-[#EA580C] text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Embedding into Vector DB...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  <span>Upload & Index Document</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

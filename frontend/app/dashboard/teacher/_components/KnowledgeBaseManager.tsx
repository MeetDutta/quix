"use client";

import { useState, useRef, useEffect } from "react";
import { 
  BookOpen, 
  Upload, 
  Trash2, 
  FileText, 
  Download, 
  FileUp, 
  CheckCircle2, 
  AlertCircle,
  FileCode,
  Layers,
  X
} from "lucide-react";
import { apiFetch, API_BASE } from "../../../../lib/api";
import { useToast } from "../../../../components/Toast";

interface KnowledgeBaseManagerProps {
  documents: any[];
  token: string | null;
  onRefresh: () => void;
}

export default function KnowledgeBaseManager({ documents, token, onRefresh }: KnowledgeBaseManagerProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [kbFile, setKbFile] = useState<File | null>(null);
  const [kbSubjectId, setKbSubjectId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);

  // Extract unique subjects from documents
  useEffect(() => {
    if (Array.isArray(documents)) {
      const subs = Array.from(new Set(documents.map((d) => d.subject_id).filter(Boolean)));
      setAvailableSubjects(subs as string[]);
      if (subs.length > 0 && !kbSubjectId) {
        setKbSubjectId(subs[0] as string);
      }
    }
  }, [documents]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const maxSizeBytes = 25 * 1024 * 1024; // 25 MB
    if (file.size > maxSizeBytes) {
      showToast("File size exceeds 25MB limit. Please upload a smaller document.", "error");
      return;
    }
    setKbFile(file);
  };

  const handleUploadKB = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbFile) {
      showToast("Please select or drop a document to upload.", "error");
      return;
    }
    if (!kbSubjectId.trim()) {
      showToast("Please specify a subject domain for this document.", "error");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", kbFile);
      formData.append("subject_id", kbSubjectId.trim());

      const res = await apiFetch("/kb/upload", { 
        token, 
        method: "POST", 
        body: formData 
      });

      if (res.ok) {
        showToast(`Document "${kbFile.name}" indexed into vector store!`, "success");
        setKbFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        onRefresh();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.detail || "Document upload failed. Please check file format.", "error");
      }
    } catch {
      showToast("Upload network error. Please verify backend server connection.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string, docTitle: string) => {
    if (!confirm(`Are you sure you want to remove "${docTitle}" from the Knowledge Base? Associated vectors will be de-indexed.`)) {
      return;
    }
    setDeletingDocId(docId);
    try {
      const res = await apiFetch(`/kb/documents/${docId}`, {
        token,
        method: "DELETE"
      });
      if (res.ok) {
        showToast(`Document "${docTitle}" removed from Knowledge Base.`, "success");
        onRefresh();
      } else {
        showToast("Failed to delete document from server.", "error");
      }
    } catch {
      showToast("Network error while deleting document.", "error");
    } finally {
      setDeletingDocId(null);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* ─── LEFT: UPLOAD & INDEXING FORM ─── */}
      <div className="lg:col-span-5 bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="border-b border-[#E5E0D8] dark:border-[#292524] pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] rounded-lg">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#242321] dark:text-[#F5F5F4]">Upload Knowledge Source</h2>
              <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">Embed course materials into Vector DB</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleUploadKB} className="space-y-4 text-xs">
          
          {/* Subject Field & Preset Dropdown */}
          <div className="space-y-1.5">
            <label className="block font-bold text-[#57534E] dark:text-[#A8A29E] uppercase tracking-wider text-[11px]">
              Subject Domain / Course Code
            </label>
            <div className="space-y-2">
              <input 
                type="text" 
                required 
                value={kbSubjectId} 
                onChange={(e) => setKbSubjectId(e.target.value)} 
                placeholder="e.g. CS-101 or Computer Science" 
                className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:ring-1 focus:ring-[#C84B18]" 
              />

              {availableSubjects.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-[#716D67]">Existing:</span>
                  {availableSubjects.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setKbSubjectId(sub)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                        kbSubjectId.toLowerCase() === sub.toLowerCase()
                          ? "bg-[#C84B18] text-white"
                          : "bg-[#F0ECE4] dark:bg-[#292524] text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321]"
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Drag and Drop Zone */}
          <div className="space-y-1.5">
            <label className="block font-bold text-[#57534E] dark:text-[#A8A29E] uppercase tracking-wider text-[11px]">
              Course Material (PDF, DOCX, TXT, PPTX)
            </label>
            
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                isDragging
                  ? "border-[#C84B18] bg-[#C84B18]/5 scale-[0.99]"
                  : kbFile
                  ? "border-emerald-500/60 bg-emerald-50/20 dark:bg-emerald-950/10"
                  : "border-[#E5E0D8] dark:border-[#292524] hover:bg-[#F7F4EF]/50 dark:hover:bg-[#1C1A17]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.doc,.txt,.pptx,.ppt,.md,.csv,.json"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    validateAndSetFile(e.target.files[0]);
                  }
                }}
              />

              {kbFile ? (
                <div className="space-y-1.5">
                  <div className="w-10 h-10 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="font-bold text-[#242321] dark:text-[#F5F5F4] text-xs truncate max-w-xs">{kbFile.name}</div>
                  <div className="text-[10px] text-[#716D67]">{formatFileSize(kbFile.size)}</div>
                  <span className="text-[10px] text-[#C84B18] hover:underline block pt-1">Click to replace file</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="w-10 h-10 mx-auto rounded-full bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] flex items-center justify-center">
                    <FileUp className="h-5 w-5" />
                  </div>
                  <div className="font-bold text-[#242321] dark:text-[#F5F5F4] text-xs">Drop files here or click to browse</div>
                  <p className="text-[10px] text-[#716D67] dark:text-[#A8A29E]">
                    Supports PDF, DOCX, TXT, PPTX (Max 25MB per file)
                  </p>
                </div>
              )}
            </div>
          </div>

          <button 
            disabled={isUploading || !kbFile} 
            type="submit" 
            className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Extracting & Indexing Vector Chunks...</span>
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                <span>Index Material into Vector DB</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* ─── RIGHT: INDEXED DOCUMENTS LIST ─── */}
      <div className="lg:col-span-7 bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#C84B18]" />
            <h2 className="text-sm font-bold text-[#242321] dark:text-[#F5F5F4]">Indexed Knowledge Sources</h2>
          </div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#C84B18]/10 text-[#C84B18]">
            {documents.length} sources active
          </span>
        </div>

        <div className="divide-y divide-[#E5E0D8] dark:divide-[#292524] border border-[#E5E0D8] dark:border-[#292524] rounded-xl overflow-hidden max-h-[460px] overflow-y-auto">
          {documents.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <BookOpen className="h-8 w-8 mx-auto text-[#716D67]/40" />
              <div className="text-xs font-semibold text-[#716D67] dark:text-[#A8A29E]">
                No documents indexed in this workspace yet.
              </div>
              <p className="text-[11px] text-[#716D67]/80 max-w-sm mx-auto">
                Upload lecture slides, course textbooks, or revision sheets on the left to start generating AI assessments with Gemini RAG.
              </p>
            </div>
          ) : (
            documents.map((doc) => (
              <div 
                key={doc.id} 
                className="p-3.5 flex items-center justify-between text-xs hover:bg-[#F7F4EF]/50 dark:hover:bg-[#1C1A17] transition-colors gap-3"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 rounded-lg bg-[#C84B18]/10 text-[#C84B18] shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="truncate flex-1">
                    <div className="font-bold text-[#242321] dark:text-[#F5F5F4] truncate">{doc.title}</div>
                    <div className="text-[10px] text-[#716D67] flex items-center gap-2 mt-0.5">
                      <span className="font-mono">{doc.filename}</span>
                      <span>•</span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold uppercase text-[9px]">
                        {doc.subject_id || "General"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                    Vector Indexed
                  </span>

                  <button
                    onClick={() => handleDeleteDocument(doc.id, doc.title)}
                    disabled={deletingDocId === doc.id}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                    title="Remove from Knowledge Base"
                  >
                    {deletingDocId === doc.id ? (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

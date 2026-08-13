"use client";

import { useState } from "react";
import { BookOpen, Upload, Trash2, FileText, Download } from "lucide-react";
import { apiFetch } from "../../../../lib/api";
import { useToast } from "../../../../components/Toast";

interface KnowledgeBaseManagerProps {
  documents: any[];
  token: string | null;
  onRefresh: () => void;
}

export default function KnowledgeBaseManager({ documents, token, onRefresh }: KnowledgeBaseManagerProps) {
  const { showToast } = useToast();
  const [kbFile, setKbFile] = useState<File | null>(null);
  const [kbSubjectId, setKbSubjectId] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadKB = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbFile || !kbSubjectId) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", kbFile);
      formData.append("subject_id", kbSubjectId);
      const res = await apiFetch("/kb/upload", { token, method: "POST", body: formData });
      if (res.ok) {
        showToast("Knowledge document vector indexed!", "success");
        setKbFile(null); setKbSubjectId("");
        onRefresh();
      } else {
        showToast("Document upload failed", "error");
      }
    } catch {
      showToast("Upload network error", "error");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-5 space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#C84B18]" />
          <span>Upload Vector Knowledge Source</span>
        </h2>
        <form onSubmit={handleUploadKB} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Subject Code</label>
            <input type="text" required value={kbSubjectId} onChange={(e) => setKbSubjectId(e.target.value)} placeholder="e.g. computer_science_101" className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-2 text-xs" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Document File (PDF, Word, Text)</label>
            <input type="file" required onChange={(e) => setKbFile(e.target.files?.[0] || null)} className="w-full text-xs text-[#716D67] file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-[#E5E0D8] file:text-[#242321]" />
          </div>
          <button disabled={isUploading} type="submit" className="btn-primary w-full py-2 flex items-center justify-center gap-2">
            <Upload className="h-3.5 w-3.5" />
            <span>{isUploading ? "Indexing Vector Chunks..." : "Index Material into Vector DB"}</span>
          </button>
        </form>
      </div>

      <div className="lg:col-span-7 bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#242321] dark:text-[#F5F5F4]">Indexed Knowledge Sources</h2>
          <span className="text-xs font-semibold text-[#716D67]">{documents.length} sources</span>
        </div>
        <div className="divide-y divide-[#E5E0D8] dark:divide-[#292524] border border-[#E5E0D8] dark:border-[#292524] rounded-lg overflow-hidden">
          {documents.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#716D67]">No documents uploaded to vector store yet.</div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="p-3 flex items-center justify-between text-xs hover:bg-[#F7F4EF]/50 dark:hover:bg-[#1C1A17]">
                <div className="flex items-center gap-2.5">
                  <FileText className="h-4 w-4 text-[#C84B18]" />
                  <div>
                    <div className="font-bold text-[#242321] dark:text-[#F5F5F4]">{doc.title}</div>
                    <div className="text-[10px] text-[#716D67]">{doc.filename}</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                  Indexed
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Users, Upload, Plus, FileSpreadsheet, Pencil, Trash2, Mail, RefreshCw, Copy, Link, Send } from "lucide-react";
import { apiFetch, getFrontendBaseUrl } from "../../../../lib/api";
import { useToast } from "../../../../components/Toast";

interface StudentRosterProps {
  students: any[];
  token: string | null;
  onRefresh: () => void;
}

export default function StudentRoster({ students, token, onRefresh }: StudentRosterProps) {
  const { showToast } = useToast();
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentRoll, setStudentRoll] = useState("");
  const [isCreatingStudent, setIsCreatingStudent] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const handleResendAuth = async (studentId: string) => {
    setResendingId(studentId);
    try {
      const res = await apiFetch(`/students/${studentId}/resend-auth`, { token, method: "POST" });
      if (res.ok) {
        showToast("Authorization email re-dispatched to student inbox!", "success");
      } else {
        showToast("Failed to resend authorization email", "error");
      }
    } catch {
      showToast("Network error resending email", "error");
    } finally {
      setResendingId(null);
    }
  };

  const handleCopyAuthLink = (st: any) => {
    const vUrl = st.verification_url || `${getFrontendBaseUrl()}/verify-student?token=${st.verification_token}`;
    navigator.clipboard.writeText(vUrl);
    showToast("Authorization link copied to clipboard!", "success");
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingStudent(true);
    try {
      const res = await apiFetch("/students", {
        token, method: "POST",
        body: JSON.stringify({ email: studentEmail, full_name: studentName, roll_number: studentRoll })
      });
      if (res.ok) {
        showToast("Student profile created & authorization email dispatched!", "success");
        setStudentName(""); setStudentEmail(""); setStudentRoll("");
        onRefresh();
      } else {
        const err = await res.json().catch(() => ({ detail: "Server error creating student record." }));
        showToast(err.detail || "Failed to create student", "error");
      }
    } catch {
      showToast("Network error creating student. Please check server connection.", "error");
    } finally {
      setIsCreatingStudent(false);
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", csvFile);
      const res = await apiFetch("/students/import", { token, method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "CSV imported successfully!", "success");
        setCsvFile(null);
        onRefresh();
      } else {
        showToast(data.detail || "Failed to import CSV", "error");
      }
    } catch {
      showToast("CSV upload error", "error");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Single Student Creation */}
        <div className="lg:col-span-5 bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-5 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#C84B18]" />
            <span>Add Single Candidate Record</span>
          </h2>
          <form onSubmit={handleAddStudent} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold mb-1">Full Name</label>
              <input required type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="e.g. Alex Johnson" className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-2 text-xs" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Institutional Email</label>
              <input required type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} placeholder="alex@university.edu" className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-2 text-xs" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Roll / Candidate ID</label>
              <input required type="text" value={studentRoll} onChange={(e) => setStudentRoll(e.target.value)} placeholder="CS-2026-101" className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-2 text-xs" />
            </div>
            <button disabled={isCreatingStudent} type="submit" className="btn-primary w-full py-2 flex items-center justify-center gap-2">
              {isCreatingStudent ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              <span>{isCreatingStudent ? "Creating & Dispatched Email..." : "Create Student Record"}</span>
            </button>
          </form>

          {/* Bulk CSV Upload */}
          <div className="pt-4 border-t border-[#E5E0D8] dark:border-[#292524] space-y-3">
            <h3 className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#C84B18]" />
              <span>Bulk Roster CSV Upload</span>
            </h3>
            <form onSubmit={handleCsvImport} className="space-y-2 text-xs">
              <input type="file" accept=".csv" required onChange={(e) => setCsvFile(e.target.files?.[0] || null)} className="w-full text-xs text-[#716D67] file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-[#E5E0D8] file:text-[#242321]" />
              <button disabled={isImporting} type="submit" className="w-full py-2 bg-[#E5E0D8] dark:bg-[#292524] text-[#242321] dark:text-[#F5F5F4] rounded-lg font-semibold hover:bg-[#D8D2C7]">
                {isImporting ? "Processing CSV..." : "Upload Roster CSV"}
              </button>
            </form>
          </div>
        </div>

        {/* Roster Table */}
        <div className="lg:col-span-7 bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
              <Users className="h-4 w-4 text-[#C84B18]" />
              <span>Enrolled Candidate Directory</span>
            </h2>
            <span className="text-xs font-semibold text-[#716D67]">{students.length} students</span>
          </div>

          <div className="divide-y divide-[#E5E0D8] dark:divide-[#292524] border border-[#E5E0D8] dark:border-[#292524] rounded-lg overflow-hidden">
            {students.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#716D67]">No candidate records created yet.</div>
            ) : (
              students.map((st) => (
                <div key={st.id} className="p-3 flex items-center justify-between text-xs hover:bg-[#F7F4EF]/50 dark:hover:bg-[#1C1A17] transition-all">
                  <div>
                    <div className="font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
                      <span>{st.full_name}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${st.is_verified ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                        {st.is_verified ? 'Verified' : 'Pending Auth'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#716D67]">{st.email} • Roll: {st.roll_number}</div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopyAuthLink(st)}
                      className="px-2 py-1 bg-[#E5E0D8]/60 dark:bg-[#292524] hover:bg-[#D8D2C7] text-[#242321] dark:text-[#F5F5F4] rounded text-[11px] font-semibold flex items-center gap-1 transition-all"
                      title="Copy Authorization Verification URL"
                    >
                      <Copy className="h-3 w-3 text-[#C84B18]" />
                      <span>Copy Link</span>
                    </button>

                    <button
                      type="button"
                      disabled={resendingId === st.id}
                      onClick={() => handleResendAuth(st.id)}
                      className="px-2 py-1 bg-[#C84B18]/10 hover:bg-[#C84B18]/20 text-[#C84B18] rounded text-[11px] font-semibold flex items-center gap-1 transition-all disabled:opacity-50"
                      title="Resend Authorization Email to Student Inbox"
                    >
                      <Send className={`h-3 w-3 ${resendingId === st.id ? 'animate-spin' : ''}`} />
                      <span>{resendingId === st.id ? 'Sending...' : 'Resend Email'}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

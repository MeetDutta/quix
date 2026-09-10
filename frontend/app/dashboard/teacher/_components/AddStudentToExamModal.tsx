"use client";

import { useState, useEffect } from "react";
import { X, Search, UserPlus, Check, Copy, AlertCircle, ShieldCheck, Mail } from "lucide-react";
import { apiFetch } from "../../../../lib/api";
import { useAuthStore } from "../../../../store/authStore";
import { useToast } from "../../../../components/Toast";

interface AddStudentToExamModalProps {
  examId: string;
  examName: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface StudentOption {
  id: string;
  name: string;
  email: string;
  roll_number?: string;
  department?: string;
}

interface CreatedCredential {
  candidate_id: string;
  username: string;
  password?: string;
  exam_code: string;
  expires_at_ist?: string;
  email_sent: boolean;
}

export default function AddStudentToExamModal({
  examId,
  examName,
  onClose,
  onSuccess,
}: AddStudentToExamModalProps) {
  const { token } = useAuthStore();
  const { showToast } = useToast();

  const [availableStudents, setAvailableStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [notifyStudent, setNotifyStudent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createdCredential, setCreatedCredential] = useState<CreatedCredential | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchStudents() {
      if (!examId || !token) return;
      try {
        setLoading(true);
        const res = await apiFetch(`/exams/${examId}/available-students`, { token });
        if (res.ok) {
          const data = await res.json();
          setAvailableStudents(data.students || []);
        } else {
          showToast("Failed to fetch available students", "error");
        }
      } catch {
        showToast("Error loading student directory", "error");
      } finally {
        setLoading(false);
      }
    }
    fetchStudents();
  }, [examId, token]);

  const filteredStudents = availableStudents.filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.roll_number && s.roll_number.toLowerCase().includes(q)) ||
      (s.department && s.department.toLowerCase().includes(q))
    );
  });

  const handleEnroll = async () => {
    if (!selectedStudent || !examId) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/exams/${examId}/candidates`, {
        method: "POST",
        token,
        body: JSON.stringify({
          student_id: selectedStudent.id,
          notify_student: notifyStudent,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedCredential({
          candidate_id: data.candidate_id,
          username: data.credential?.username || "",
          password: data.credential?.password || "",
          exam_code: data.exam_code,
          expires_at_ist: data.credential?.expires_at_ist,
          email_sent: data.email_sent,
        });
        showToast(`Student ${selectedStudent.name} enrolled successfully!`, "success");
        onSuccess();
      } else {
        const err = await res.json().catch(() => ({ detail: "Enrollment failed" }));
        showToast(err.detail || "Enrollment failed", "error");
      }
    } catch {
      showToast("Network error during candidate enrollment", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdCredential) return;
    const text = `Exam Portal Credentials\nExam: ${examName}\nExam Code: ${createdCredential.exam_code}\nUsername: ${createdCredential.username}\nPassword: ${createdCredential.password || "(Already Set / Secret)"}\nExpires: ${createdCredential.expires_at_ist || "Exam End"}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast("Credentials copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E0D8] dark:border-[#292524]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#C84B18]/10 text-[#C84B18] rounded-xl">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#242321] dark:text-[#F5F5F4]">
                Enroll Student to Live Exam
              </h3>
              <p className="text-xs text-[#716D67] truncate max-w-xs sm:max-w-sm">
                Exam: {examName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#716D67] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* If credential already created, show result view */}
        {createdCredential ? (
          <div className="space-y-4 py-2">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                <ShieldCheck className="h-4 w-4" />
                <span>Student Enrolled Successfully</span>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                The student is now enrolled and ready to take the exam. Live Monitor will update automatically.
              </p>
            </div>

            <div className="bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-3.5 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#716D67]">Exam Code</span>
                <span className="font-mono font-bold text-[#C84B18]">{createdCredential.exam_code}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#716D67]">Exam Username</span>
                <span className="font-mono font-bold text-[#242321] dark:text-[#F5F5F4]">{createdCredential.username}</span>
              </div>
              {createdCredential.password && (
                <div className="flex justify-between items-center">
                  <span className="text-[#716D67]">Exam Password</span>
                  <span className="font-mono font-bold text-[#242321] dark:text-[#F5F5F4]">{createdCredential.password}</span>
                </div>
              )}
              {createdCredential.expires_at_ist && (
                <div className="flex justify-between items-center">
                  <span className="text-[#716D67]">Session Expiry</span>
                  <span className="font-mono text-[#716D67]">{createdCredential.expires_at_ist}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-[#E5E0D8] dark:border-[#292524]">
                <span className="text-[#716D67]">Invitation Email</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {createdCredential.email_sent ? "Dispatched" : "Queued / Off"}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="flex-1 py-2 px-3 bg-[#E5E0D8] dark:bg-[#292524] hover:bg-[#D6D0C4] text-[#242321] dark:text-[#F5F5F4] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? "Copied!" : "Copy Details"}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 px-3 bg-[#C84B18] hover:bg-[#A83D12] text-white rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Search filter */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#716D67]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search directory student by name, email, roll..."
                className="w-full pl-9 pr-3 py-2 bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none"
              />
            </div>

            {/* Students list */}
            <div className="flex-1 overflow-y-auto border border-[#E5E0D8] dark:border-[#292524] rounded-xl max-h-56 divide-y divide-[#E5E0D8] dark:divide-[#292524]">
              {loading ? (
                <div className="py-8 text-center text-xs text-[#716D67]">Loading workspace directory...</div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#716D67] px-4">
                  {searchTerm ? "No matching students found." : "All workspace students are already enrolled in this exam."}
                </div>
              ) : (
                filteredStudents.map((s) => {
                  const isSelected = selectedStudent?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStudent(s)}
                      className={`w-full text-left p-2.5 sm:p-3 transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? "bg-[#C84B18]/10 dark:bg-[#C84B18]/20 text-[#C84B18]"
                          : "hover:bg-[#F7F4EF] dark:hover:bg-[#1A1918] text-[#242321] dark:text-[#F5F5F4]"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-xs truncate">{s.name}</div>
                        <div className="text-[11px] text-[#716D67] truncate">{s.email}</div>
                        {s.roll_number && (
                          <div className="text-[10px] text-[#716D67] font-mono">Roll: {s.roll_number}</div>
                        )}
                      </div>
                      <div className="shrink-0">
                        {isSelected ? (
                          <div className="h-5 w-5 rounded-full bg-[#C84B18] text-white flex items-center justify-center">
                            <Check className="h-3 w-3" />
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded-full border border-[#E5E0D8] dark:border-[#292524]" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Notification Checkbox */}
            <div className="flex items-center gap-2 px-1 text-xs">
              <input
                id="notify-student"
                type="checkbox"
                checked={notifyStudent}
                onChange={(e) => setNotifyStudent(e.target.checked)}
                className="rounded accent-[#C84B18] cursor-pointer"
              />
              <label htmlFor="notify-student" className="text-[#716D67] dark:text-[#A8A29E] cursor-pointer flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                <span>Send invitation email with login credentials immediately</span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-[#E5E0D8] dark:border-[#292524]">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 px-3 border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] rounded-xl font-bold text-xs hover:bg-[#F7F4EF] dark:hover:bg-[#1A1918] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedStudent || submitting}
                onClick={handleEnroll}
                className="flex-1 py-2 px-3 bg-[#C84B18] hover:bg-[#A83D12] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>{submitting ? "Enrolling..." : "Enroll Student"}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

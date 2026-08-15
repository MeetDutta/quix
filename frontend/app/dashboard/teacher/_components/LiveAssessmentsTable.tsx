import { useState } from "react";
import { 
  Eye, Radio, StopCircle, Sparkles, Printer, Key, QrCode, Trash2, 
  Download, X, Play, Search, Copy, Check, ExternalLink, ShieldCheck, Mail, CopyPlus
} from "lucide-react";
import { API_V1, apiFetch, getFrontendBaseUrl } from "../../../../lib/api";
import { useAuthStore } from "../../../../store/authStore";
import { useToast } from "../../../../components/Toast";
import LiveProctoringModal from "./LiveProctoringModal";

interface LiveAssessmentsTableProps {
  exams: any[];
  onOpenCreate: () => void;
  onPreviewExam: (exam: any) => void;
  onOpenLiveProctor: (exam: any) => void;
  onEndExamEarly: (examId: string, examName: string) => void;
  onPublishExam: (examId: string) => void;
  onDeleteExam: (examId: string) => void;
  onGenerateCredentials: (examId: string, examName: string) => void;
  onDownloadCredentialsCSV: (examId: string, examName: string) => void;
  onRefreshExams?: () => void;
}

export default function LiveAssessmentsTable({
  exams,
  onOpenCreate,
  onPreviewExam,
  onOpenLiveProctor,
  onEndExamEarly,
  onPublishExam,
  onDeleteExam,
  onGenerateCredentials,
  onDownloadCredentialsCSV,
  onRefreshExams,
}: LiveAssessmentsTableProps) {
  const { token } = useAuthStore();
  const { showToast } = useToast();
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [qrModalExam, setQrModalExam] = useState<any | null>(null);
  const [credsModalData, setCredsModalData] = useState<{ examName: string; examId: string; examCode: string; creds: any[] } | null>(null);
  const [loadingCredsExamId, setLoadingCredsExamId] = useState<string | null>(null);
  const [credsSearch, setCredsSearch] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [resendingStudentId, setResendingStudentId] = useState<string | null>(null);
  const [isResendingAll, setIsResendingAll] = useState(false);
  const [liveProctorExamId, setLiveProctorExamId] = useState<string | null>(null);
  const [cloningExamId, setCloningExamId] = useState<string | null>(null);

  const handleCloneExam = async (exam: any) => {
    setCloningExamId(exam.id);
    try {
      const res = await apiFetch(`/exams/${exam.id}/clone`, {
        method: "POST",
        token,
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`Exam cloned as new draft: '${data.name}'!`, "success");
        if (onRefreshExams) onRefreshExams();
      } else {
        showToast("Failed to clone exam", "error");
      }
    } catch {
      showToast("Network error cloning exam", "error");
    } finally {
      setCloningExamId(null);
    }
  };

  const getExamScheduleInfo = (exam: any) => {
    if (!exam.is_published) {
      return { status: "draft", label: "Draft", dot: "bg-amber-500" };
    }
    const now = new Date();
    const start = exam.start_time ? new Date(exam.start_time) : null;
    const end = exam.end_time ? new Date(exam.end_time) : null;

    if (start && now < start) {
      return { status: "scheduled", label: "Scheduled", dot: "bg-blue-500" };
    }
    if (end && now > end) {
      return { status: "completed", label: "Completed", dot: "bg-stone-400" };
    }
    return { status: "live", label: "Live Active", dot: "bg-emerald-500 animate-pulse" };
  };

  const handleOpenCredentialsPreview = async (exam: any) => {
    setLoadingCredsExamId(exam.id);
    setCredsSearch("");
    try {
      const res = await apiFetch(`/exams/${exam.id}/credentials`, { token, method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const credsList = Array.isArray(data) ? data : [];
        setCredsModalData({
          examId: exam.id,
          examName: exam.name,
          examCode: exam.exam_code || exam.code,
          creds: credsList,
        });
        showToast(`Loaded ${credsList.length} candidate credentials. Emails dispatched automatically.`, "success");
      } else {
        showToast("Failed to retrieve candidate credentials", "error");
      }
    } catch {
      showToast("Network error loading candidate passcodes", "error");
    } finally {
      setLoadingCredsExamId(null);
    }
  };

  const handleResendSingleCredEmail = async (studentId: string | undefined, studentName: string, email?: string) => {
    if (!credsModalData) return;
    setResendingStudentId(studentId || studentName);
    try {
      const url = studentId 
        ? `/exams/${credsModalData.examId}/resend-credentials-email?student_id=${studentId}`
        : `/exams/${credsModalData.examId}/resend-credentials-email`;
      const res = await apiFetch(url, { token, method: "POST" });
      if (res.ok) {
        showToast(`Email with credentials sent to ${email || studentName}!`, "success");
      } else {
        showToast(`Failed to send email to ${studentName}`, "error");
      }
    } catch {
      showToast("Network error sending email", "error");
    } finally {
      setResendingStudentId(null);
    }
  };

  const handleResendAllEmails = async () => {
    if (!credsModalData) return;
    setIsResendingAll(true);
    try {
      const res = await apiFetch(`/exams/${credsModalData.examId}/resend-credentials-email`, { token, method: "POST" });
      if (res.ok) {
        const data = await res.json();
        showToast(`Dispatched credentials emails to all ${data.dispatched_count || credsModalData.creds.length} candidates!`, "success");
      } else {
        showToast("Failed to resend credentials emails", "error");
      }
    } catch {
      showToast("Network error resending emails", "error");
    } finally {
      setIsResendingAll(false);
    }
  };

  const handleCopySingleCred = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    showToast("Copied to clipboard!", "success");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyAllCredentials = () => {
    if (!credsModalData || credsModalData.creds.length === 0) return;
    const portalUrl = `${getFrontendBaseUrl()}/exam/${credsModalData.examCode}`;
    let text = `📝 Assessment: ${credsModalData.examName} (Code: ${credsModalData.examCode})\n`;
    text += `🔗 Candidate Portal: ${portalUrl}\n\n`;
    text += `Candidate Credentials Roster:\n`;
    credsModalData.creds.forEach((c, idx) => {
      text += `${idx + 1}. ${c.student_name || "Student"} | Roll: ${c.roll_number || "N/A"} | User: ${c.username} | Passcode: ${c.password}\n`;
    });
    navigator.clipboard.writeText(text);
    showToast("All candidate credentials formatted and copied to clipboard!", "success");
  };

  const filteredCreds = credsModalData?.creds.filter((c) => {
    const q = credsSearch.toLowerCase();
    return (
      (c.student_name && c.student_name.toLowerCase().includes(q)) ||
      (c.roll_number && c.roll_number.toLowerCase().includes(q)) ||
      (c.username && c.username.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  }) || [];

  return (
    <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-lg overflow-hidden space-y-0">
      <div className="p-4 border-b border-[#E5E0D8] dark:border-[#292524] flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#242321] dark:text-[#F5F5F4]">Recent Assessments</h2>
          <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-0.5">
            Manage your AI synthesized examinations, live proctoring rooms, and candidate credentials.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E]">
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium">Title & Code</th>
              <th className="py-3 px-4 font-medium">Questions</th>
              <th className="py-3 px-4 font-medium">Duration</th>
              <th className="py-3 px-4 font-medium">Schedule Window</th>
              <th className="py-3 px-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E0D8] dark:divide-[#292524]">
            {exams.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-[#716D67]">
                  No assessments created yet. Click "Create Assessment" to synthesize a new examination.
                </td>
              </tr>
            ) : (
              exams.map((exam) => {
                const sched = getExamScheduleInfo(exam);
                const isLoadingCreds = loadingCredsExamId === exam.id;

                return (
                  <tr
                    key={exam.id}
                    className="hover:bg-[#F0ECE4]/30 dark:hover:bg-[#1D1B19]/30 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${sched.dot}`} />
                        <span className="capitalize font-medium text-[11px]">{sched.label}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#242321] dark:text-[#F5F5F4]">{exam.name}</div>
                      <div className="text-[11px] text-[#716D67] dark:text-[#A8A29E] font-mono mt-0.5">
                        {exam.exam_code}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#716D67] dark:text-[#A8A29E]">
                      {exam.questions_count || (exam.questions_json ? JSON.parse(exam.questions_json).length : 0)} Qs ({exam.total_marks} pts)
                    </td>
                    <td className="py-3.5 px-4 text-[#716D67] dark:text-[#A8A29E]">
                      {exam.duration_minutes}m
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-[#716D67] dark:text-[#A8A29E]">
                      {exam.start_time
                        ? `${new Date(exam.start_time).toLocaleDateString()} - ${new Date(exam.end_time).toLocaleDateString()}`
                        : "Immediate"}
                    </td>
                    <td className="py-3.5 px-4 text-right relative">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Live Anti-Cheat & Progress Proctor Room */}
                        {exam.is_published && (
                          <button
                            type="button"
                            onClick={() => setLiveProctorExamId(exam.id)}
                            className="p-1.5 rounded border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all flex items-center gap-1 text-[10px] font-semibold"
                            title="Open Real-time Live Proctoring Room"
                          >
                            <Radio className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 animate-pulse" />
                            <span className="hidden sm:inline">Live Monitor</span>
                          </button>
                        )}

                        {/* Test Run Exam as Student (Sandbox Simulation) */}
                        <a
                          href={`/exam/${exam.exam_code || exam.code}?mode=teacher_preview`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all flex items-center gap-1 text-[10px] font-semibold"
                          title="Test Run & Simulate Assessment as Student"
                        >
                          <Play className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="hidden sm:inline">Test Run</span>
                        </a>

                        {/* 1-Click Clone Exam Button */}
                        <button
                          type="button"
                          disabled={cloningExamId === exam.id}
                          onClick={() => handleCloneExam(exam)}
                          className="p-1.5 rounded border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#C84B18] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] transition-all flex items-center gap-1 text-[10px] font-semibold"
                          title="Clone Assessment as New Draft"
                        >
                          <CopyPlus className="h-3.5 w-3.5 text-[#C84B18]" />
                          <span className="hidden sm:inline">Clone</span>
                        </button>

                        {/* Preview Question Paper Modal Button */}
                        <button
                          type="button"
                          onClick={() => onPreviewExam(exam)}
                          className="p-1.5 rounded border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#C84B18] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] transition-all"
                          title="Interactive Question Studio & Preview"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {/* End Early Button (if active & published) */}
                        {exam.is_published && (!sched || sched.status === "live" || sched.status === "scheduled") && (
                          <button
                            type="button"
                            onClick={() => onEndExamEarly(exam.id, exam.name)}
                            className="px-2 py-1 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all flex items-center gap-1 text-[10px] font-semibold"
                            title="End Live Assessment Early"
                          >
                            <StopCircle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                            <span>End Early</span>
                          </button>
                        )}

                        {/* Publish Live Button (if draft) */}
                        {!exam.is_published && (
                          <button
                            type="button"
                            onClick={() => onPublishExam(exam.id)}
                            className="px-2 py-1 rounded bg-[#C84B18] text-white dark:bg-[#EA580C] text-[10px] font-semibold hover:opacity-90 transition-all flex items-center gap-1"
                            title="Publish Assessment Live to Students"
                          >
                            <Sparkles className="h-3 w-3" />
                            <span>Publish</span>
                          </button>
                        )}

                        {/* Printable Question Paper PDF */}
                        <a
                          href={`${API_V1}/exams/${exam.id}/pdf/question-paper`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524]"
                          title="Print Question Paper PDF"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </a>

                        {/* Preview & Generate Candidate Credentials Button */}
                        <button
                          type="button"
                          disabled={isLoadingCreds}
                          onClick={() => handleOpenCredentialsPreview(exam)}
                          className={`p-1.5 rounded border border-[#E5E0D8] dark:border-[#292524] transition-all flex items-center gap-1 text-[10px] font-semibold ${
                            isLoadingCreds
                              ? "bg-[#C84B18]/10 text-[#C84B18]"
                              : "text-[#716D67] hover:text-[#C84B18] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524]"
                          }`}
                          title="Preview & Generate Candidate Passcodes & Credentials"
                        >
                          {isLoadingCreds ? (
                            <div className="w-3.5 h-3.5 border-2 border-[#C84B18] border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Key className="h-3.5 w-3.5" />
                          )}
                          <span className="hidden md:inline">Credentials</span>
                        </button>

                        {/* QR Code Flyer Modal Button */}
                        <button
                          type="button"
                          onClick={() => setQrModalExam(exam)}
                          className="p-1.5 rounded border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524]"
                          title="Display & Print QR Code Flyer"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                        </button>

                        {/* Delete Exam */}
                        {deleteConfirmId === exam.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteExam(exam.id);
                                setDeleteConfirmId(null);
                              }}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-1.5 py-1 text-[10px] text-[#716D67]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(exam.id)}
                            className="p-1.5 rounded text-[#716D67] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                            title="Delete Assessment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ═══════ QR CODE FLYER MODAL ═══════ */}
      {qrModalExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center relative">
            <button
              onClick={() => setQrModalExam(null)}
              className="absolute top-4 right-4 p-1 rounded-lg text-[#716D67] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] transition-all"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex p-3 rounded-2xl bg-[#C84B18]/10 text-[#C84B18] mb-1">
                <QrCode className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">{qrModalExam.name}</h3>
              <p className="text-xs text-[#716D67]">Scan with mobile camera to launch exam portal</p>
            </div>

            {/* High-Resolution QR Code */}
            <div className="bg-white p-4 inline-block mx-auto rounded-xl border border-[#E5E0D8] shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  `${getFrontendBaseUrl()}/exam/${qrModalExam.exam_code}`
                )}`}
                alt={`QR Code for ${qrModalExam.name}`}
                className="w-44 h-44 mx-auto rounded"
              />
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-2.5 flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-[#C84B18] truncate text-[11px]">
                  {getFrontendBaseUrl()}/exam/{qrModalExam.exam_code}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${getFrontendBaseUrl()}/exam/${qrModalExam.exam_code}`);
                    showToast("Exam portal URL copied to clipboard!", "success");
                  }}
                  className="bg-white dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] px-2 py-1 rounded text-xs font-bold text-[#C84B18] hover:bg-[#F0ECE4] shrink-0"
                >
                  Copy
                </button>
              </div>

              <div className="text-[11px] text-[#716D67]">
                Exam Code: <b className="font-mono text-[#C84B18]">{qrModalExam.exam_code}</b>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Printer className="h-4 w-4" />
              <span>Print QR Code Flyer</span>
            </button>
          </div>
        </div>
      )}

      {/* ═══════ GENERATED CREDENTIALS PREVIEW MODAL ═══════ */}
      {credsModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] rounded-xl border border-[#C84B18]/20">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">
                    Candidate Access Credentials Preview
                  </h3>
                  <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                    Assessment: <b className="text-[#C84B18]">{credsModalData.examName}</b> ({credsModalData.examCode}) • {credsModalData.creds.length} Candidates Enrolled
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCredsModalData(null)}
                className="p-1.5 rounded-lg text-[#716D67] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search & Bulk Copy / Resend Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#716D67]" />
                <input
                  type="text"
                  value={credsSearch}
                  onChange={(e) => setCredsSearch(e.target.value)}
                  placeholder="Search candidate name, email, roll number, or username..."
                  className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:ring-1 focus:ring-[#C84B18]"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isResendingAll}
                  onClick={handleResendAllEmails}
                  className="px-3 py-1.5 rounded-lg border border-[#C84B18]/30 bg-[#C84B18]/10 text-xs font-semibold text-[#C84B18] hover:bg-[#C84B18]/20 flex items-center gap-1.5 transition-all shadow-xs"
                  title="Resend access passcodes email to all enrolled candidates"
                >
                  {isResendingAll ? (
                    <div className="w-3.5 h-3.5 border-2 border-[#C84B18] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                  <span>Resend All Emails</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyAllCredentials}
                  className="px-3 py-1.5 rounded-lg border border-[#E5E0D8] dark:border-[#292524] bg-white dark:bg-[#171615] text-xs font-semibold text-[#716D67] hover:text-[#242321] dark:hover:text-white flex items-center gap-1.5 transition-all shadow-xs"
                  title="Copy formatted list of all candidate credentials"
                >
                  <Copy className="h-3.5 w-3.5 text-[#C84B18]" />
                  <span>Copy All</span>
                </button>
              </div>
            </div>

            {/* Credentials Table Preview */}
            <div className="overflow-y-auto flex-1 border border-[#E5E0D8] dark:border-[#292524] rounded-xl overflow-hidden bg-[#F7F4EF]/40 dark:bg-[#141312]/40">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-[#E5E0D8]/60 dark:bg-[#292524] text-[#716D67] dark:text-[#A8A29E] uppercase font-bold sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Candidate</th>
                    <th className="py-2.5 px-3">Roll No.</th>
                    <th className="py-2.5 px-3">Exam Username</th>
                    <th className="py-2.5 px-3">Timed PIN</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E0D8] dark:divide-[#292524]">
                  {filteredCreds.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-[#716D67]">
                        {credsSearch ? "No credentials match your search." : "No credentials generated yet."}
                      </td>
                    </tr>
                  ) : (
                    filteredCreds.map((c, idx) => {
                      const rowKey = `${c.username}_${idx}`;
                      const isCopied = copiedKey === rowKey;
                      const isSendingEmail = resendingStudentId === (c.student_id || c.student_name);

                      return (
                        <tr key={idx} className="hover:bg-[#F0ECE4]/60 dark:hover:bg-[#1D1B19] transition-all">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[#242321] dark:text-[#F5F5F4]">
                              {c.student_name || "Enrolled Student"}
                            </div>
                            {c.email && (
                              <div className="text-[10px] text-[#716D67] font-mono">{c.email}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#716D67] text-[11px]">
                            {c.roll_number || "—"}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#C84B18] text-[11px]">
                            {c.username}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded px-2 py-0.5 text-xs">
                              {c.password}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Resend Email Button */}
                              <button
                                type="button"
                                disabled={isSendingEmail}
                                onClick={() => handleResendSingleCredEmail(c.student_id, c.student_name, c.email)}
                                className="px-2 py-1 rounded border border-[#E5E0D8] dark:border-[#292524] text-[11px] font-semibold text-[#716D67] hover:text-[#C84B18] hover:bg-white dark:hover:bg-[#292524] transition-all inline-flex items-center gap-1"
                                title={`Resend passcode email to ${c.email || c.student_name}`}
                              >
                                {isSendingEmail ? (
                                  <div className="w-3 h-3 border-2 border-[#C84B18] border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Mail className="h-3 w-3" />
                                )}
                                <span className="hidden sm:inline">Send Email</span>
                              </button>

                              {/* Copy Individual PIN */}
                              <button
                                type="button"
                                onClick={() => handleCopySingleCred(`User: ${c.username}\nPIN: ${c.password}\nPortal: ${getFrontendBaseUrl()}/exam/${credsModalData.examCode}`, rowKey)}
                                className="px-2 py-1 rounded border border-[#E5E0D8] dark:border-[#292524] text-[11px] font-semibold text-[#716D67] hover:text-[#C84B18] hover:bg-white dark:hover:bg-[#292524] transition-all inline-flex items-center gap-1"
                                title="Copy candidate login credentials"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-600" />
                                    <span className="text-emerald-600">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 pt-3 border-t border-[#E5E0D8] dark:border-[#292524]">
              <div className="text-[11px] text-[#716D67] flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Passcodes are sent automatically to students' authorized emails.</span>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => onDownloadCredentialsCSV(credsModalData.examId, credsModalData.examName)}
                  className="flex-1 sm:flex-none btn-primary py-2 px-4 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Passcodes CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCredsModalData(null)}
                  className="px-4 py-2 rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-xs font-semibold text-[#716D67] hover:text-[#242321] dark:hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Proctoring & Telemetry Modal */}
      {liveProctorExamId && (
        <LiveProctoringModal
          examId={liveProctorExamId}
          onClose={() => setLiveProctorExamId(null)}
        />
      )}
    </div>
  );
}

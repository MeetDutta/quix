"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "../../../store/authStore";
import { useToast } from "../../../components/Toast";
import { apiFetch } from "../../../lib/api";
import { 
  Upload, Plus, FileSpreadsheet, BookOpen, Cpu, Calendar, Lock, ChevronRight, 
  Clipboard, Check, Download, Users, LineChart, Eye, Trash2, AlertCircle,
  Sparkles, Key, Trophy, Share2, FileText, Printer, Copy, BarChart3, 
  GraduationCap, FolderOpen, Clock, QrCode, X
} from "lucide-react";

export default function TeacherDashboard() {
  const { token, fullName } = useAuthStore();
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<"exams" | "students" | "kb" | "reports">("exams");
  
  // Data
  const [students, setStudents] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any | null>(null);
  const [qrModalExam, setQrModalExam] = useState<any | null>(null);
  const [credsModalData, setCredsModalData] = useState<{ examName: string; examId: string; creds: any[] } | null>(null);
  const [kbSubjects, setKbSubjects] = useState<any[]>([]);

  // Form: Student
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentRoll, setStudentRoll] = useState("");
  
  // Form: KB Upload
  const [kbFile, setKbFile] = useState<File | null>(null);
  const [kbSubjectId, setKbSubjectId] = useState("");
  
  // Form: Exam Generator
  const [examName, setExamName] = useState("");
  const [examSubject, setExamSubject] = useState("");
  const [examTopic, setExamTopic] = useState("General");
  const [examDuration, setExamDuration] = useState("30");
  const [examMarks, setExamMarks] = useState("50");
  const [examPass, setExamPass] = useState("20");
  const [examNegative, setExamNegative] = useState("0");
  const [numMcq, setNumMcq] = useState("5");
  const [numSubjective, setNumSubjective] = useState("1");
  const [questionType, setQuestionType] = useState<"mcq" | "subjective" | "tf" | "mixed">("mcq");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [isGenerating, setIsGenerating] = useState(false);

  // Form: Scheduling
  const [examStartDate, setExamStartDate] = useState("");
  const [examEndDate, setExamEndDate] = useState("");

  // Reports
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // CSV Import
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Live timer tick for schedule status
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getExamScheduleInfo = (exam: any) => {
    if (!exam.is_published) {
      return { status: "draft", label: "Draft", color: "bg-[#F3EDE2] text-[#78716C] border-[#E7E0D3]", countdown: null };
    }
    
    const startTime = exam.start_time ? new Date(exam.start_time).getTime() : null;
    const endTime = exam.end_time ? new Date(exam.end_time).getTime() : null;
    const current = now;

    if (startTime && current < startTime) {
      const diffSecs = Math.floor((startTime - current) / 1000);
      const days = Math.floor(diffSecs / 86400);
      const hours = Math.floor((diffSecs % 86400) / 3600);
      const mins = Math.floor((diffSecs % 3600) / 60);
      const secs = diffSecs % 60;
      
      let countdownStr = "";
      if (days > 0) countdownStr = `${days}d ${hours}h ${mins}m`;
      else countdownStr = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

      return { 
        status: "scheduled", 
        label: "Scheduled", 
        color: "bg-amber-50 text-amber-700 border-amber-300", 
        countdown: countdownStr 
      };
    }

    if (endTime && current >= endTime) {
      return { status: "ended", label: "Ended", color: "bg-rose-50 text-rose-700 border-rose-200", countdown: null };
    }

    return { status: "live", label: "Live Now", color: "bg-emerald-50 text-emerald-700 border-emerald-200", countdown: null };
  };

  // ─── Data Fetchers ─────────────────────────────────────
  const fetchStudents = async () => {
    try {
      const res = await apiFetch("/students/", { token });
      if (res.ok) setStudents(await res.json());
    } catch {}
  };

  const fetchKbSubjects = async () => {
    try {
      const res = await apiFetch("/kb/subjects", { token });
      if (res.ok) {
        const data = await res.json();
        setKbSubjects(data);
      }
    } catch {}
  };

  const fetchDocuments = async () => {
    try {
      const res = await apiFetch("/kb/documents", { token });
      if (res.ok) {
        setDocuments(await res.json());
        fetchKbSubjects();
      }
    } catch {}
  };

  const fetchExams = async () => {
    try {
      const res = await apiFetch("/exams/", { token });
      if (res.ok) setExams(await res.json());
    } catch {}
  };

  useEffect(() => {
    if (token) { fetchStudents(); fetchDocuments(); fetchExams(); fetchKbSubjects(); }
  }, [token]);

  // ─── Handlers ──────────────────────────────────────────
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch("/students/", {
        token, method: "POST",
        body: JSON.stringify({ email: studentEmail, full_name: studentName, roll_number: studentRoll })
      });
      if (res.ok) {
        showToast("Student profile created successfully.", "success");
        setStudentName(""); setStudentEmail(""); setStudentRoll("");
        fetchStudents();
      } else {
        const d = await res.json();
        showToast(d.detail || "Failed to create student", "error");
      }
    } catch { showToast("Network error", "error"); }
  };

  const handleUploadKB = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbFile) {
      showToast("Please select a file to upload", "warning");
      return;
    }
    const formData = new FormData();
    formData.append("file", kbFile);
    formData.append("subject_id", kbSubjectId || "general_101");
    try {
      const res = await apiFetch("/kb/upload", { token, method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        showToast("Material indexed into vector store!", "success");
        setKbFile(null); fetchDocuments();
      } else {
        showToast(data.detail || "Upload failed", "error");
      }
    } catch { showToast("Upload network error", "error"); }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const res = await apiFetch("/exams/generate-from-kb", {
        token, method: "POST",
        body: JSON.stringify({
          name: examName || "Sample AI Quiz",
          subject_id: examSubject || "general_101",
          topic: examTopic || "General Concepts",
          duration_minutes: parseInt(examDuration) || 30,
          total_marks: parseFloat(examMarks) || 50,
          passing_marks: parseFloat(examPass) || 20,
          negative_marking: parseFloat(examNegative) || 0,
          num_mcq: parseInt(numMcq) || 5,
          num_subjective: parseInt(numSubjective) || 1,
          question_type: questionType,
          difficulty,
          ...(examStartDate ? { start_time: new Date(examStartDate).toISOString() } : {}),
          ...(examEndDate ? { end_time: new Date(examEndDate).toISOString() } : {})
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Exam "${data.name}" compiled with ${JSON.parse(data.questions_json).length} questions!`, "success");
        setExamName(""); fetchExams();
      } else { showToast(data.detail || "Generation failed", "error"); }
    } catch { showToast("Connection error generating questions", "error"); }
    finally { setIsGenerating(false); }
  };

  const handlePublishExam = async (examId: string) => {
    try {
      const res = await apiFetch(`/exams/${examId}/publish`, { token, method: "POST" });
      if (res.ok) { showToast("Exam is now LIVE!", "success"); fetchExams(); }
    } catch {}
  };

  const handleGenerateCredentials = async (examId: string, examName: string) => {
    try {
      const res = await apiFetch(`/exams/${examId}/credentials`, { token, method: "POST" });
      if (res.ok) {
        const creds = await res.json();
        setCredsModalData({ examName, examId, creds });
        showToast(`${creds.length} student credentials generated!`, "success");
      } else { showToast("No enrolled students to generate credentials for", "warning"); }
    } catch {}
  };

  const handleDeleteExam = async (examId: string) => {
    try {
      const res = await apiFetch(`/exams/${examId}`, { token, method: "DELETE" });
      if (res.ok) { showToast("Exam deleted.", "info"); setDeleteConfirmId(null); fetchExams(); }
    } catch {}
  };

  const handleImportCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    setIsImporting(true);
    const formData = new FormData();
    formData.append("file", csvFile);
    try {
      const res = await apiFetch("/students/import", { token, method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        setCsvFile(null); fetchStudents();
      } else { showToast("Import failed", "error"); }
    } catch { showToast("CSV import error", "error"); }
    finally { setIsImporting(false); }
  };

  const fetchExamSummary = async (examId: string) => {
    setSelectedExamId(examId);
    try {
      const res = await apiFetch(`/reports/exam-summary/${examId}`, { token });
      if (res.ok) setSummaries(await res.json());
    } catch {}
  };

  const handleDownloadCredentialsCSV = async (examId: string, examName: string) => {
    try {
      const res = await apiFetch(`/exams/${examId}/credentials/export`, { token });
      if (!res.ok) {
        showToast("Failed to download credentials CSV", "error");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `credentials_${examName.replace(/\s+/g, "_")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("Downloaded credentials CSV!", "success");
    } catch {
      showToast("Error downloading CSV file", "error");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!", "info");
  };

  // ─── Stats ─────────────────────────────────────────────
  const totalExams = exams.length;
  const liveExams = exams.filter(e => e.is_published).length;
  const totalStudents = students.length;
  const totalDocs = documents.length;

  const inputCls = "w-full bg-[#FBF9F5] border border-[#E7E0D3] rounded-xl px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#9A3412]/30 focus:border-[#9A3412] transition-all";
  const inputSmCls = "w-full bg-white border border-[#E7E0D3] rounded-lg px-3 py-1.5 text-sm text-[#1C1917] focus:outline-none focus:ring-1 focus:ring-[#9A3412]";
  const labelCls = "text-xs font-bold text-[#57534E] uppercase tracking-wider";
  const labelSmCls = "text-[11px] font-bold text-[#57534E]";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ═══════ TOP BANNER ═══════ */}
      <div className="bg-white border border-[#E7E0D3] rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="bg-[#FCEBE6] text-[#9A3412] border border-[#F7D5CA] text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1.5 mb-2">
              <Sparkles className="h-3.5 w-3.5" /> Quiz Creator
            </span>
            <h1 className="text-2xl font-extrabold text-[#1C1917] tracking-tight">Welcome, {fullName || "Instructor"}</h1>
          </div>
        </div>

        {/* ═══ Stats Cards ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {[
            { label: "Total Exams", value: totalExams, sub: `${liveExams} live`, icon: <FileText className="h-4 w-4" />, color: "text-[#9A3412] bg-[#FCEBE6] border-[#F7D5CA]" },
            { label: "Students", value: totalStudents, sub: "enrolled", icon: <Users className="h-4 w-4" />, color: "text-blue-700 bg-blue-50 border-blue-200" },
            { label: "KB Documents", value: totalDocs, sub: "indexed", icon: <FolderOpen className="h-4 w-4" />, color: "text-purple-700 bg-purple-50 border-purple-200" },
            { label: "Papers Generated", value: exams.reduce((sum, e) => sum + (e.questions_json ? JSON.parse(e.questions_json).length : 0), 0), sub: "total questions", icon: <BarChart3 className="h-4 w-4" />, color: "text-emerald-700 bg-emerald-50 border-emerald-200" }
          ].map((stat, i) => (
            <div key={i} className="bg-[#FBF9F5] border border-[#E7E0D3] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#78716C] uppercase tracking-wider">{stat.label}</span>
                <span className={`p-1.5 rounded-lg border ${stat.color}`}>{stat.icon}</span>
              </div>
              <div className="text-2xl font-extrabold text-[#1C1917]">{stat.value}</div>
              <div className="text-[11px] text-[#78716C]">{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* ═══ Sub-Navigation ═══ */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-[#F0E8DD]">
          {([
            { id: "exams" as const, emoji: "📝", label: "Create & Schedule Quiz" },
            { id: "kb" as const, emoji: "📚", label: "Subject Knowledge Base" },
            { id: "students" as const, emoji: "👥", label: "Student Roster & CSV" },
            { id: "reports" as const, emoji: "🏆", label: "Leaderboard & Analytics" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-[#FCEBE6] text-[#9A3412] border border-[#F7D5CA] shadow-xs"
                  : "bg-[#FBF9F5] text-[#57534E] border border-[#E7E0D3] hover:bg-[#F3EDE2] hover:text-[#1C1917]"
              }`}
            >
              <span>{tab.emoji}</span><span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══════ TAB 1: CREATE & SCHEDULE QUIZ ═══════ */}
      {activeTab === "exams" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ─── Left: AI Question Generator ─── */}
          <div className="lg:col-span-5 bg-white border border-[#E7E0D3] rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-4 border-b border-[#F0E8DD]">
              <div className="p-2 bg-[#FCEBE6] text-[#9A3412] rounded-xl border border-[#F7D5CA]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1C1917]">AI Question Generator & Settings</h2>
                <p className="text-xs text-[#78716C]">Configure subject, rules & AI blueprint</p>
              </div>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className={labelCls}>Knowledge Base Subject</label>
                  <span className="text-[10px] font-bold text-[#9A3412] bg-[#FCEBE6] px-2 py-0.5 rounded-full border border-[#F7D5CA]">Linked RAG Context</span>
                </div>
                {kbSubjects.length > 0 ? (
                  <select
                    required
                    value={examSubject}
                    onChange={(e) => setExamSubject(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select Knowledge Base Subject...</option>
                    {kbSubjects.map((s) => (
                      <option key={s.subject_id} value={s.subject_id}>
                        📚 {s.name} ({s.document_count} KB Document{s.document_count > 1 ? "s" : ""})
                      </option>
                    ))}
                    <option value="general_101">🌐 General Study (Fallback KB)</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={examSubject}
                    onChange={(e) => setExamSubject(e.target.value)}
                    placeholder="e.g. general_101 or biology_101"
                    className={inputCls}
                  />
                )}
                <p className="text-[11px] text-[#78716C]">
                  Questions will be strictly generated using documents uploaded under this Knowledge Base subject.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Quiz Title</label>
                <input type="text" required value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="e.g. Chapter 4 Biology Midterm Test" className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelCls}>Time Limit (Min)</label>
                  <input type="number" value={examDuration} onChange={(e) => setExamDuration(e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Total Marks</label>
                  <input type="number" value={examMarks} onChange={(e) => setExamMarks(e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* ─── Date/Time Scheduling ─── */}
              <div className="bg-[#FBF9F5] border border-[#E7E0D3] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-[#9A3412]" />
                  <span className="text-xs font-bold text-[#9A3412] uppercase tracking-wider">Schedule Window</span>
                  <span className="text-[10px] text-[#78716C]">(optional)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={labelSmCls}>Start Date & Time</label>
                    <input type="datetime-local" value={examStartDate} onChange={(e) => setExamStartDate(e.target.value)} className={inputSmCls} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelSmCls}>End Date & Time</label>
                    <input type="datetime-local" value={examEndDate} onChange={(e) => setExamEndDate(e.target.value)} className={inputSmCls} />
                  </div>
                </div>
              </div>

              {/* ─── Question Blueprint Config ─── */}
              <div className="bg-[#FBF9F5] border border-[#E7E0D3] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#9A3412] uppercase tracking-wider">✨ Question Blueprint Config</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={labelSmCls}>No. of MCQs</label>
                    <input type="number" value={numMcq} onChange={(e) => setNumMcq(e.target.value)} min="0" max="50" className={inputSmCls} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelSmCls}>No. of Subjective</label>
                    <input type="number" value={numSubjective} onChange={(e) => setNumSubjective(e.target.value)} min="0" max="20" className={inputSmCls} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={labelSmCls}>Question Type</label>
                    <select value={questionType} onChange={(e: any) => setQuestionType(e.target.value)} className={inputSmCls + " text-xs"}>
                      <option value="mcq">MCQ Only</option>
                      <option value="subjective">Subjective Only</option>
                      <option value="tf">True / False</option>
                      <option value="mixed">Mixed (MCQ + Subjective)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className={labelSmCls}>Difficulty Level</label>
                    <select value={difficulty} onChange={(e: any) => setDifficulty(e.target.value)} className={inputSmCls + " text-xs"}>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={labelSmCls}>Topic Keyword</label>
                  <input type="text" value={examTopic} onChange={(e) => setExamTopic(e.target.value)} placeholder="Topic (e.g. Photosynthesis, Respiration)" className={inputSmCls} />
                </div>

                <button type="submit" disabled={isGenerating} className="w-full bg-gradient-to-r from-[#9A3412] to-[#C2410C] hover:from-[#7C2D12] hover:to-[#9A3412] text-white font-bold rounded-xl py-3 text-xs transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {isGenerating ? (
                    <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /><span>Generating Questions with AI...</span></>
                  ) : (
                    <span>Generate Non-Repeating Questions from Subject KB</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ─── Right: Exam Papers List ─── */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1C1917]">Question Papers & Live Links</h2>
              <span className="text-xs text-[#78716C]">{exams.length} papers created</span>
            </div>

            <div className="space-y-4">
              {exams.length === 0 ? (
                <div className="bg-white border border-[#E7E0D3] rounded-2xl p-8 text-center text-[#78716C] text-sm">
                  No exams generated yet. Configure options on the left and click Generate!
                </div>
              ) : (
                exams.map((exam) => {
                  const parsedQuestions = exam.questions_json ? JSON.parse(exam.questions_json) : [];
                  const sched = getExamScheduleInfo(exam);
                  return (
                    <div key={exam.id} className="bg-white border border-[#E7E0D3] rounded-2xl p-5 shadow-xs hover:border-[#D6CBB8] transition-all flex flex-col gap-3 animate-fadeIn">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#1C1917] text-base">{exam.name}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${sched.color}`}>
                            {sched.label}
                          </span>
                          {sched.countdown && (
                            <span className="text-[11px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 animate-pulse">
                              ⏰ Opens in {sched.countdown}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <a
                            href={`http://localhost:8000/api/v1/exams/${exam.id}/pdf/question-paper`}
                            target="_blank" rel="noreferrer"
                            className="bg-[#FBF9F5] border border-[#E7E0D3] hover:bg-[#F3EDE2] text-[#292524] text-xs font-semibold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1"
                          >
                            <Printer className="h-3.5 w-3.5 text-[#9A3412]" /><span>Paper</span>
                          </a>

                          {!exam.is_published ? (
                            <button onClick={() => handlePublishExam(exam.id)} className="bg-gradient-to-r from-[#9A3412] to-[#C2410C] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-xs">
                              Publish
                            </button>
                          ) : (
                            <button 
                              onClick={() => {
                                handleGenerateCredentials(exam.id, exam.name);
                                handleDownloadCredentialsCSV(exam.id, exam.name);
                              }} 
                              className="bg-gradient-to-r from-[#9A3412] to-[#C2410C] text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5 hover:opacity-95"
                              title="Generate student exam passcodes, send automated email credentials with test links, and download CSV"
                            >
                              <Key className="h-3.5 w-3.5 text-white" />
                              <span>Credentials</span>
                            </button>
                          )}

                          <button
                            onClick={() => setQrModalExam(exam)}
                            className="bg-[#FBF9F5] border border-[#E7E0D3] text-[#292524] hover:bg-[#F3EDE2] text-xs font-semibold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1"
                            title="Display Exam Link QR Code"
                          >
                            <QrCode className="h-3.5 w-3.5 text-[#9A3412]" />
                            <span>QR</span>
                          </button>

                          {/* Delete button */}
                          {deleteConfirmId === exam.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDeleteExam(exam.id)} className="bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all">Confirm</button>
                              <button onClick={() => setDeleteConfirmId(null)} className="text-[#78716C] text-[10px] font-bold px-2 py-1.5 hover:text-[#1C1917]">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirmId(exam.id)} className="p-2 rounded-xl text-[#A8A29E] hover:text-rose-500 hover:bg-rose-50 transition-all" title="Delete Exam">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-[#78716C]">
                        <span>Duration: <b>{exam.duration_minutes} min</b></span>
                        <span>Marks: <b>{exam.total_marks}</b></span>
                        <span>Questions: <b className="text-[#9A3412]">{parsedQuestions.length} Items</b></span>
                        <span>Code: <code className="bg-[#F5F0E8] text-[#9A3412] px-2 py-0.5 rounded font-mono font-bold cursor-pointer hover:bg-[#FCEBE6]" onClick={() => copyToClipboard(exam.exam_code)}>{exam.exam_code}</code></span>
                        {exam.start_time && (
                          <span title={`Full Window: ${new Date(exam.start_time).toLocaleString()} to ${exam.end_time ? new Date(exam.end_time).toLocaleString() : 'No Limit'}`}>
                            Schedule: <b className="text-[#1C1917]">{new Date(exam.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</b>
                          </span>
                        )}
                      </div>

                      {/* Question Review */}
                      {parsedQuestions.length > 0 && (
                        <details className="bg-[#FBF9F5] border border-[#E7E0D3] rounded-xl">
                          <summary className="p-3 text-xs font-bold text-[#1C1917] cursor-pointer hover:bg-[#F3EDE2] rounded-xl transition-all select-none">
                            Question Paper Review ({parsedQuestions.length} Items)
                          </summary>
                          <div className="p-3 pt-0 space-y-2 max-h-48 overflow-y-auto">
                            {parsedQuestions.map((q: any, idx: number) => (
                              <div key={q.id || idx} className="text-xs bg-white border border-[#E7E0D3] p-2.5 rounded-lg space-y-1">
                                <div className="font-semibold text-[#1C1917]">
                                  Q{idx + 1}. {q.question_text} <span className="text-[#9A3412] text-[11px] font-normal">[{q.marks} Marks]</span>
                                </div>
                                {q.options && (
                                  <div className="grid grid-cols-2 gap-1 text-[11px] text-[#57534E]">
                                    {q.options.map((opt: string, i: number) => (
                                      <div key={i} className={opt === q.correct_answer ? "font-bold text-emerald-700" : ""}>
                                        ({String.fromCharCode(65 + i)}) {opt}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {exam.is_published && (
                        <div className="flex items-center justify-between gap-2 bg-[#FBF9F5] border border-[#E7E0D3] px-3 py-2 rounded-xl text-xs">
                          <span className="text-[#57534E] font-mono truncate max-w-[280px]">
                            http://localhost:8000/static/exam.html?code={exam.exam_code}
                          </span>
                          <button onClick={() => copyToClipboard(`http://localhost:8000/static/exam.html?code=${exam.exam_code}`)} className="text-[#9A3412] font-semibold hover:underline shrink-0 flex items-center gap-1">
                            <Share2 className="h-3.5 w-3.5" /><span>Copy Link</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ TAB 2: STUDENT ROSTER & CSV ═══════ */}
      {activeTab === "students" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            {/* Manual Add Student */}
            <div className="bg-white border border-[#E7E0D3] rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-[#1C1917] flex items-center gap-2">
                <Users className="h-5 w-5 text-[#9A3412]" /><span>Add Student Profile</span>
              </h2>
              <form onSubmit={handleAddStudent} className="space-y-3">
                <div className="space-y-1"><label className={labelSmCls}>FULL NAME</label><input type="text" required value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="e.g. Alex Johnson" className={inputCls} /></div>
                <div className="space-y-1"><label className={labelSmCls}>EMAIL ADDRESS</label><input type="email" required value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} placeholder="alex@institution.edu" className={inputCls} /></div>
                <div className="space-y-1"><label className={labelSmCls}>ROLL NUMBER</label><input type="text" required value={studentRoll} onChange={(e) => setStudentRoll(e.target.value)} placeholder="e.g. CS-2024-001" className={inputCls} /></div>
                <button type="submit" className="w-full bg-gradient-to-r from-[#9A3412] to-[#C2410C] text-white font-bold rounded-xl py-3 text-xs shadow-xs transition-all">Create Student Record</button>
              </form>
            </div>

            {/* CSV Bulk Import */}
            <div className="bg-white border border-[#E7E0D3] rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
                <Upload className="h-4 w-4 text-[#9A3412]" /><span>Bulk Import from CSV</span>
              </h2>
              <form onSubmit={handleImportCSV} className="space-y-3">
                <div className="border-2 border-dashed border-[#E7E0D3] rounded-xl p-4 text-center hover:border-[#9A3412]/30 transition-all">
                  <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} className="text-xs text-[#57534E] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#FCEBE6] file:text-[#9A3412] hover:file:bg-[#F7D5CA]" />
                  <p className="text-[10px] text-[#A8A29E] mt-2">CSV columns: full_name, email, roll_number, division, batch</p>
                </div>
                <button type="submit" disabled={!csvFile || isImporting} className="w-full bg-[#FBF9F5] border border-[#E7E0D3] text-[#292524] hover:bg-[#F3EDE2] font-semibold rounded-xl py-2.5 text-xs transition-all disabled:opacity-50">
                  {isImporting ? "Importing..." : "Import Students from CSV"}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white border border-[#E7E0D3] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1C1917]">Enrolled Student Directory</h2>
              <span className="text-xs text-[#78716C]">{students.length} students</span>
            </div>
            <div className="divide-y divide-[#F0E8DD]">
              {students.length === 0 ? (
                <div className="py-8 text-center text-[#78716C] text-sm">No students enrolled yet.</div>
              ) : students.map((st) => (
                <div key={st.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold text-[#1C1917]">{st.full_name}</div>
                    <div className="text-xs text-[#78716C]">{st.email}</div>
                  </div>
                  <span className="bg-[#F5F0E8] text-[#9A3412] text-xs font-mono font-bold px-2.5 py-1 rounded-lg border border-[#E7E0D3]">{st.roll_number}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ TAB 3: KNOWLEDGE BASE ═══════ */}
      {activeTab === "kb" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-[#E7E0D3] rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#1C1917] flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#9A3412]" /><span>Upload Study Material (PDF/Text)</span>
            </h2>
            <form onSubmit={handleUploadKB} className="space-y-4">
              <div className="space-y-1"><label className={labelSmCls}>SUBJECT / COURSE CODE</label><input type="text" value={kbSubjectId} onChange={(e) => setKbSubjectId(e.target.value)} placeholder="e.g. biology_101" className={inputCls} /></div>
              <div className="space-y-1">
                <label className={labelSmCls}>SELECT DOCUMENT FILE</label>
                <input type="file" required onChange={(e) => setKbFile(e.target.files?.[0] || null)} className="w-full text-xs text-[#57534E] file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#FCEBE6] file:text-[#9A3412] hover:file:bg-[#F7D5CA]" />
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-[#9A3412] to-[#C2410C] text-white font-bold rounded-xl py-3 text-xs shadow-xs transition-all">Index Material into Vector DB</button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white border border-[#E7E0D3] rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#1C1917]">Indexed Knowledge Documents</h2>
            <div className="divide-y divide-[#F0E8DD]">
              {documents.length === 0 ? (
                <div className="py-8 text-center text-[#78716C] text-sm">No documents indexed yet.</div>
              ) : documents.map((doc) => (
                <div key={doc.id} className="py-3 flex items-center justify-between text-sm">
                  <div><div className="font-semibold text-[#1C1917]">{doc.filename}</div><div className="text-xs text-[#78716C]">Subject: {doc.subject_id || "General"}</div></div>
                  <span className="text-xs text-[#9A3412] font-semibold bg-[#FCEBE6] px-2.5 py-1 rounded-full border border-[#F7D5CA]">v{doc.version} Indexed</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ TAB 4: LEADERBOARD & ANALYTICS ═══════ */}
      {activeTab === "reports" && (
        <div className="bg-white border border-[#E7E0D3] rounded-2xl p-6 shadow-xs space-y-6">
          <h2 className="text-base font-bold text-[#1C1917] flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[#9A3412]" /><span>Exam Performance & Gradebook</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {exams.map((ex) => (
              <button key={ex.id} onClick={() => fetchExamSummary(ex.id)}
                className={`p-4 rounded-xl text-left border transition-all ${
                  selectedExamId === ex.id ? "bg-[#FCEBE6] border-[#F7D5CA] text-[#9A3412]" : "bg-[#FBF9F5] border-[#E7E0D3] text-[#292524] hover:bg-[#F3EDE2]"
                }`}
              >
                <div className="font-bold text-sm">{ex.name}</div>
                <div className="text-xs text-[#78716C] mt-1">Code: {ex.exam_code}</div>
              </button>
            ))}
          </div>

          {summaries && (
            <div className="space-y-4 pt-4 border-t border-[#F0E8DD] animate-fadeIn">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Attended", value: summaries.attended_students, sub: `of ${summaries.total_students}` },
                  { label: "Average Score", value: summaries.average_score, sub: "marks" },
                  { label: "Highest", value: summaries.highest_score, sub: "marks" },
                  { label: "Pass Rate", value: `${summaries.pass_rate}%`, sub: "passed" },
                ].map((s, i) => (
                  <div key={i} className="bg-[#FBF9F5] border border-[#E7E0D3] rounded-xl p-3 text-center">
                    <div className="text-xl font-extrabold text-[#1C1917]">{s.value}</div>
                    <div className="text-[10px] text-[#78716C] uppercase font-bold tracking-wider">{s.label}</div>
                    <div className="text-[10px] text-[#A8A29E]">{s.sub}</div>
                  </div>
                ))}
              </div>

              <h3 className="font-bold text-sm text-[#1C1917]">Submissions ({summaries.submissions?.length || 0})</h3>
              <div className="divide-y divide-[#F0E8DD]">
                {summaries.submissions?.map((sub: any) => (
                  <div key={sub.submission_id} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-semibold text-[#1C1917]">{sub.student_name}</div>
                      <div className="text-xs text-[#78716C]">Score: {sub.score} ({sub.percentage}%) {sub.proctor_alerts > 0 && <span className="text-rose-500 font-semibold">⚠ {sub.proctor_alerts} alerts</span>}</div>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Completed</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ QR CODE MODAL ═══════ */}
      {qrModalExam && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-[#E7E0D3] shadow-xl text-center space-y-5 animate-fadeIn relative">
            <button
              onClick={() => setQrModalExam(null)}
              className="absolute top-4 right-4 p-1 rounded-lg text-[#78716C] hover:bg-[#F5F0E8] transition-all"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex p-3 rounded-2xl bg-[#FCEBE6] text-[#9A3412] border border-[#F7D5CA] mb-1">
                <QrCode className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-[#1C1917]">{qrModalExam.name}</h3>
              <p className="text-xs text-[#78716C]">Scan with mobile camera to launch secure exam portal</p>
            </div>

            {/* High-Resolution QR Code */}
            <div className="bg-[#FBF9F5] border border-[#E7E0D3] rounded-2xl p-4 inline-block mx-auto shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`http://localhost:3000/exam/${qrModalExam.exam_code}`)}`}
                alt={`QR Code for ${qrModalExam.name}`}
                className="w-48 h-48 mx-auto rounded-lg"
              />
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-[#FCEBE6] border border-[#F7D5CA] rounded-xl p-2.5 flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-[#9A3412] truncate">
                  http://localhost:3000/exam/{qrModalExam.exam_code}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`http://localhost:3000/exam/${qrModalExam.exam_code}`);
                    showToast("Exam portal URL copied to clipboard!", "success");
                  }}
                  className="bg-white border border-[#E7E0D3] px-2 py-1 rounded-lg text-[#9A3412] font-bold hover:bg-[#F3EDE2] shrink-0"
                >
                  Copy
                </button>
              </div>

              <div className="text-[11px] text-[#78716C]">
                Exam Code: <b className="font-mono text-[#9A3412]">{qrModalExam.exam_code}</b>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full bg-gradient-to-r from-[#9A3412] to-[#C2410C] text-white font-bold rounded-xl py-2.5 text-xs shadow-xs hover:from-[#7C2D12] hover:to-[#9A3412] transition-all flex items-center justify-center gap-1.5"
            >
              <Printer className="h-4 w-4" />
              <span>Print QR Code Flyer</span>
            </button>
          </div>
        </div>
      )}

      {/* ═══════ GENERATED CREDENTIALS MODAL ═══════ */}
      {credsModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white border border-[#E7E0D3] rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#F0E8DD] pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#FCEBE6] text-[#9A3412] rounded-xl border border-[#F7D5CA]">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1C1917]">Generated Student Credentials</h3>
                  <p className="text-xs text-[#78716C]">
                    Exam: <b className="text-[#9A3412]">{credsModalData.examName}</b> ({credsModalData.creds.length} Students)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCredsModalData(null)}
                className="p-2 rounded-xl text-[#78716C] hover:bg-[#F5F0E8] hover:text-[#1C1917] transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Table of credentials */}
            <div className="overflow-y-auto flex-1 space-y-2 border border-[#E7E0D3] rounded-xl p-2 bg-[#FBF9F5]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F3EDE2] text-[#57534E] uppercase font-bold sticky top-0 rounded-lg">
                  <tr>
                    <th className="p-2.5 rounded-l-lg">Student Name</th>
                    <th className="p-2.5">Roll No.</th>
                    <th className="p-2.5">Exam Username</th>
                    <th className="p-2.5 rounded-r-lg">Passcode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E0D3]">
                  {credsModalData.creds.map((c, idx) => (
                    <tr key={idx} className="hover:bg-white transition-all">
                      <td className="p-2.5 font-semibold text-[#1C1917]">{c.student_name || "Enrolled Student"}</td>
                      <td className="p-2.5 text-[#78716C] font-mono">{c.roll_number || "—"}</td>
                      <td className="p-2.5 font-mono font-bold text-[#9A3412]">{c.username}</td>
                      <td className="p-2.5 font-mono font-bold text-emerald-700 bg-emerald-50 rounded px-2 py-0.5 inline-block my-1">{c.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 shrink-0 pt-2 border-t border-[#F0E8DD]">
              <button
                onClick={() => handleDownloadCredentialsCSV(credsModalData.examId, credsModalData.examName)}
                className="flex-1 bg-gradient-to-r from-[#9A3412] to-[#C2410C] text-white font-bold rounded-xl py-2.5 text-xs shadow-xs hover:from-[#7C2D12] hover:to-[#9A3412] transition-all flex items-center justify-center gap-1.5"
              >
                <Download className="h-4 w-4" />
                <span>Download Credentials CSV</span>
              </button>

              <button
                onClick={() => setCredsModalData(null)}
                className="bg-[#FBF9F5] border border-[#E7E0D3] text-[#292524] font-semibold rounded-xl px-5 py-2.5 text-xs hover:bg-[#F3EDE2] transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "../../../store/authStore";
import { useToast } from "../../../components/Toast";
import { apiFetch } from "../../../lib/api";
import { 
  Upload, Plus, FileSpreadsheet, BookOpen, Cpu, Calendar, Lock, ChevronRight, 
  Clipboard, Check, Download, Users, LineChart, Eye, Trash2, AlertCircle,
  Sparkles, Key, Trophy, Share2, FileText, Printer, Copy, BarChart3, 
  GraduationCap, FolderOpen, Clock, QrCode, X, ArrowRight, ArrowLeft, Pencil, Mail, CheckCircle, StopCircle
} from "lucide-react";

export default function TeacherDashboard() {
  const { token, fullName } = useAuthStore();
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<"exams" | "create" | "students" | "kb" | "reports">("exams");
  
  useEffect(() => {
    const syncTab = () => {
      const hash = window.location.hash.replace("#", "");
      if (["exams", "create", "kb", "students", "reports"].includes(hash)) {
        setActiveTab(hash as any);
      }
    };
    syncTab();
    const handleCustom = (e: any) => {
      if (e.detail && ["exams", "create", "kb", "students", "reports"].includes(e.detail)) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener("hashchange", syncTab);
    window.addEventListener("switch-tab", handleCustom);
    return () => {
      window.removeEventListener("hashchange", syncTab);
      window.removeEventListener("switch-tab", handleCustom);
    };
  }, []);
  
  // Data
  const [createStep, setCreateStep] = useState<number>(1);
  const [students, setStudents] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any | null>(null);
  const [qrModalExam, setQrModalExam] = useState<any | null>(null);
  const [credsModalData, setCredsModalData] = useState<{ examName: string; examId: string; creds: any[] } | null>(null);
  const [kbSubjects, setKbSubjects] = useState<any[]>([]);
  const [previewExam, setPreviewExam] = useState<any | null>(null);
  const [selectedReportExamId, setSelectedReportExamId] = useState<string | null>(null);
  const [reportAnalytics, setReportAnalytics] = useState<any | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [studentAnswerModal, setStudentAnswerModal] = useState<any | null>(null);

  // Form: Student Edit & Delete
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [editStudentName, setEditStudentName] = useState("");
  const [editStudentEmail, setEditStudentEmail] = useState("");
  const [editStudentRoll, setEditStudentRoll] = useState("");
  const [editStudentDivision, setEditStudentDivision] = useState("");
  const [editStudentBatch, setEditStudentBatch] = useState("");
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);

  // Form: Student Create
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
  const [numSubjective, setNumSubjective] = useState("0");
  const [questionType, setQuestionType] = useState<"mcq" | "subjective" | "tf" | "mixed">("mcq");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [isGenerating, setIsGenerating] = useState(false);

  // Form: Scheduling
  const [examStartDate, setExamStartDate] = useState("");
  const [examEndDate, setExamEndDate] = useState("");

  const setSchedulePreset = (preset: "now" | "today4pm" | "tomorrow10am") => {
    const n = new Date();
    const durMinutes = parseInt(examDuration) || 30;
    
    if (preset === "now") {
      const startStr = new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      const end = new Date(n.getTime() + (durMinutes + 120) * 60000);
      const endStr = new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setExamStartDate(startStr);
      setExamEndDate(endStr);
    } else if (preset === "today4pm") {
      const start = new Date(n.getFullYear(), n.getMonth(), n.getDate(), 16, 0);
      const end = new Date(start.getTime() + (durMinutes + 120) * 60000);
      setExamStartDate(new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      setExamEndDate(new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    } else if (preset === "tomorrow10am") {
      const start = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 10, 0);
      const end = new Date(start.getTime() + (durMinutes + 120) * 60000);
      setExamStartDate(new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      setExamEndDate(new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    }
  };

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

  const openEditStudent = (st: any) => {
    setEditingStudent(st);
    setEditStudentName(st.full_name || "");
    setEditStudentEmail(st.email || "");
    setEditStudentRoll(st.roll_number || "");
    setEditStudentDivision(st.division || "");
    setEditStudentBatch(st.batch || "");
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setIsUpdatingStudent(true);
    try {
      const res = await apiFetch(`/students/${editingStudent.id}`, {
        token,
        method: "PUT",
        body: JSON.stringify({
          full_name: editStudentName,
          email: editStudentEmail,
          roll_number: editStudentRoll,
          division: editStudentDivision,
          batch: editStudentBatch
        })
      });
      if (res.ok) {
        showToast("Student specifications updated successfully!", "success");
        setEditingStudent(null);
        fetchStudents();
      } else {
        const d = await res.json();
        showToast(d.detail || "Failed to update student", "error");
      }
    } catch {
      showToast("Network error updating student", "error");
    } finally {
      setIsUpdatingStudent(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    try {
      const res = await apiFetch(`/students/${studentId}`, {
        token,
        method: "DELETE"
      });
      if (res.ok) {
        showToast("Student removed from directory.", "success");
        setDeletingStudentId(null);
        fetchStudents();
      } else {
        const d = await res.json();
        showToast(d.detail || "Failed to delete student", "error");
      }
    } catch {
      showToast("Network error deleting student", "error");
    }
  };

  const handleResendAuth = async (studentId: string) => {
    try {
      const res = await apiFetch(`/students/${studentId}/resend-auth`, { token, method: "POST" });
      if (res.ok) {
        showToast("Authorization email re-sent successfully!", "success");
      } else {
        showToast("Failed to resend authorization email", "error");
      }
    } catch {
      showToast("Network error resending email", "error");
    }
  };

  const loadExamAnalytics = async (examId: string) => {
    setSelectedReportExamId(examId);
    setLoadingReport(true);
    try {
      const res = await apiFetch(`/reports/exam-analytics/${examId}`, { token });
      const data = await res.json();
      if (res.ok) {
        setReportAnalytics(data);
      } else {
        showToast(data.detail || "Failed to load quiz analytics", "error");
      }
    } catch {
      showToast("Network error loading analytics", "error");
    } finally {
      setLoadingReport(false);
    }
  };

  const handleDownloadGradebookCSV = async (examId: string, examName: string) => {
    try {
      const res = await apiFetch(`/reports/export-exam-csv/${examId}`, { token });
      if (!res.ok) throw new Error("Failed to export gradebook CSV");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Gradebook_${examName.replace(/\s+/g, "_")}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      showToast("Class Gradebook CSV downloaded!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to export gradebook", "error");
    }
  };

  const inspectStudentAnswerSheet = async (submissionId: string) => {
    try {
      const res = await apiFetch(`/reports/submission-detail/${submissionId}`, { token });
      const data = await res.json();
      if (res.ok) {
        setStudentAnswerModal(data);
      } else {
        showToast(data.detail || "Failed to load student answer sheet", "error");
      }
    } catch {
      showToast("Network error loading answer sheet", "error");
    }
  };

  // Auto-select first exam when entering reports tab
  useEffect(() => {
    if (activeTab === "reports" && exams.length > 0 && !selectedReportExamId) {
      loadExamAnalytics(exams[0].id);
    }
  }, [activeTab, exams, selectedReportExamId]);

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
          num_mcq: questionType === "subjective" ? 0 : (parseInt(numMcq) || 5),
          num_subjective: (questionType === "mcq" || questionType === "tf") ? 0 : (parseInt(numSubjective) || 0),
          question_type: questionType,
          difficulty,
          ...(examStartDate ? { start_time: new Date(examStartDate).toISOString() } : {}),
          ...(examEndDate ? { end_time: new Date(examEndDate).toISOString() } : {})
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Exam "${data.name}" compiled with ${JSON.parse(data.questions_json || "[]").length} questions!`, "success");
        setExamName("");
        fetchExams();
        setPreviewExam(data); // Open Preview Window automatically
      } else { showToast(data.detail || "Generation failed", "error"); }
    } catch { showToast("Connection error generating questions", "error"); }
    finally { setIsGenerating(false); }
  };

  const handlePublishExam = async (examId: string) => {
    try {
      const res = await apiFetch(`/exams/${examId}/publish`, { token, method: "POST" });
      if (res.ok) {
        showToast("Exam is now LIVE!", "success");
        fetchExams();
        if (previewExam && previewExam.id === examId) {
          setPreviewExam({ ...previewExam, is_published: true });
        }
      }
    } catch {}
  };

  const handleEndExamEarly = async (examId: string, examName: string) => {
    if (!confirm(`Are you sure you want to end "${examName}" early? Students will no longer be able to enter or submit.`)) {
      return;
    }
    try {
      const res = await apiFetch(`/exams/${examId}/end-early`, { token, method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(`Assessment "${examName}" has been ended early.`, "success");
        fetchExams();
        if (previewExam && previewExam.id === examId) {
          setPreviewExam({ ...previewExam, end_time: new Date().toISOString() });
        }
      } else {
        showToast(data.detail || "Failed to end exam early", "error");
      }
    } catch {
      showToast("Network error ending exam early", "error");
    }
  };

  const handleDeleteExam = async (examId: string) => {
    try {
      const res = await apiFetch(`/exams/${examId}`, { token, method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showToast("Assessment deleted successfully.", "success");
        setDeleteConfirmId(null);
        fetchExams();
        if (previewExam && previewExam.id === examId) {
          setPreviewExam(null);
        }
      } else {
        showToast(data.detail || "Failed to delete exam", "error");
      }
    } catch {
      showToast("Network error deleting exam", "error");
    }
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

  const handleGenerateCredentials = async (examId: string, examTitle: string) => {
    try {
      const res = await apiFetch(`/exams/${examId}/credentials`, { token, method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const credsList = Array.isArray(data) ? data : (data.credentials || []);
        setCredsModalData({ examName: examTitle, examId, creds: credsList });
        showToast(`Generated ${credsList.length} student passcodes & sent email notifications!`, "success");
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to generate passcodes", "error");
      }
    } catch (err) {
      showToast("Network error generating passcodes", "error");
    }
  };

  const handleDownloadCredentialsCSV = async (examId: string, examTitle: string) => {
    try {
      const res = await apiFetch(`/exams/${examId}/credentials/export`, { token });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Exam_Credentials_${examTitle.replace(/\s+/g, "_")}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast("Downloaded credentials CSV!", "success");
      } else {
        showToast("Failed to export credentials CSV", "error");
      }
    } catch (err) {
      showToast("Network error exporting CSV", "error");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Exam code copied to clipboard", "info");
  };

  const parseUtcDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    if (!dateStr.endsWith("Z") && !dateStr.includes("+") && !dateStr.includes("-", 10)) {
      return new Date(`${dateStr.replace(" ", "T")}Z`);
    }
    return new Date(dateStr);
  };

  const getExamScheduleInfo = (exam: any) => {
    const now = new Date();

    if (!exam.is_published) {
      return { 
        status: "draft", 
        label: "Draft", 
        color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800", 
        dot: "bg-amber-500" 
      };
    }

    const start = parseUtcDate(exam.start_time);
    const end = parseUtcDate(exam.end_time);

    if (start && now < start) {
      const diffMs = start.getTime() - now.getTime();
      const mins = Math.floor(diffMs / 60000);
      const hours = Math.floor(mins / 60);
      const days = Math.floor(hours / 24);
      let countdown = "";
      if (days > 0) countdown = `${days}d ${hours % 24}h`;
      else if (hours > 0) countdown = `${hours}h ${mins % 60}m`;
      else countdown = `${mins}m`;

      return {
        status: "scheduled",
        label: "Scheduled",
        color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
        dot: "bg-blue-500",
        countdown
      };
    }

    if (end && now > end) {
      return { 
        status: "ended", 
        label: "Ended", 
        color: "bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700", 
        dot: "bg-stone-400" 
      };
    }

    return { 
      status: "live", 
      label: "Live Now", 
      color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800", 
      dot: "bg-emerald-500" 
    };
  };

  const totalExams = exams.length;
  const liveExams = exams.filter(e => e.is_published).length;
  const totalStudents = students.length;
  const totalDocs = documents.length;

  const inputCls = "w-full bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-md px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:border-[#C84B18] transition-all";
  const labelCls = "text-xs font-semibold text-[#242321] dark:text-[#F5F5F4]";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* ═══════ 1. DASHBOARD HEADER (24-28px Title) ═══════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E0D8] dark:border-[#292524]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#242321] dark:text-[#F5F5F4]">Quiz Creator</h1>
          <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-0.5">Create and manage classroom assessments.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab("create")}
            className="btn-primary flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Create Assessment</span>
          </button>
        </div>
      </div>

      {/* ═══════ 2. COMPACT STATISTICS BAR (Subtle Dividers) ═══════ */}
      <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-[#E5E0D8] dark:divide-[#292524]">
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">Total Assessments</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-[#242321] dark:text-[#F5F5F4]">{totalExams}</span>
            <span className="text-xs text-[#716D67] dark:text-[#A8A29E]">{liveExams} live</span>
          </div>
        </div>

        <div className="space-y-1 pt-3 md:pt-0 md:pl-4">
          <span className="text-[10px] font-semibold text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">Students</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-[#242321] dark:text-[#F5F5F4]">{totalStudents}</span>
            <span className="text-xs text-[#716D67] dark:text-[#A8A29E]">enrolled</span>
          </div>
        </div>

        <div className="space-y-1 pt-3 md:pt-0 md:pl-4">
          <span className="text-[10px] font-semibold text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">Knowledge Bases</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-[#242321] dark:text-[#F5F5F4]">{totalDocs}</span>
            <span className="text-xs text-[#716D67] dark:text-[#A8A29E]">documents</span>
          </div>
        </div>

        <div className="space-y-1 pt-3 md:pt-0 md:pl-4">
          <span className="text-[10px] font-semibold text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">Questions Generated</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-[#242321] dark:text-[#F5F5F4]">
              {exams.reduce((sum, e) => sum + (e.questions_json ? JSON.parse(e.questions_json).length : 0), 0)}
            </span>
            <span className="text-xs text-[#716D67] dark:text-[#A8A29E]">total questions</span>
          </div>
        </div>
      </div>

      {/* ═══════ 3. WORKSPACE SUB-NAVIGATION ═══════ */}
      <div className="flex border-b border-[#E5E0D8] dark:border-[#292524] text-xs font-medium space-x-6">
        <button
          onClick={() => setActiveTab("exams")}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "exams"
              ? "border-[#C84B18] text-[#C84B18] dark:border-[#EA580C] dark:text-[#EA580C]"
              : "border-transparent text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321]"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Assessments Table</span>
        </button>

        <button
          onClick={() => setActiveTab("create")}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "create"
              ? "border-[#C84B18] text-[#C84B18] dark:border-[#EA580C] dark:text-[#EA580C]"
              : "border-transparent text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321]"
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Assessment Stepper</span>
        </button>

        <button
          onClick={() => setActiveTab("kb")}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "kb"
              ? "border-[#C84B18] text-[#C84B18] dark:border-[#EA580C] dark:text-[#EA580C]"
              : "border-transparent text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321]"
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Knowledge Sources</span>
        </button>

        <button
          onClick={() => setActiveTab("students")}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "students"
              ? "border-[#C84B18] text-[#C84B18] dark:border-[#EA580C] dark:text-[#EA580C]"
              : "border-transparent text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321]"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Student Directory</span>
        </button>
      </div>

      {/* ═══════ TAB 1: RECENT ASSESSMENTS DATA TABLE ═══════ */}
      {activeTab === "exams" && (
        <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-lg overflow-hidden space-y-0">
          <div className="p-4 border-b border-[#E5E0D8] dark:border-[#292524] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#242321] dark:text-[#F5F5F4]">Recent Assessments</h2>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-0.5">High-density view of active, scheduled, and past exam papers.</p>
            </div>
            <span className="text-xs text-[#716D67] dark:text-[#A8A29E] font-medium">{exams.length} papers</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F0ECE4] dark:bg-[#1D1B19] text-[#716D67] dark:text-[#A8A29E] border-b border-[#E5E0D8] dark:border-[#292524] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Assessment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Questions</th>
                  <th className="py-3 px-4">Marks</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Schedule Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D8] dark:divide-[#292524]">
                {exams.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#716D67] dark:text-[#A8A29E]">
                      No assessments created yet. Click <button onClick={() => setActiveTab("create")} className="text-[#C84B18] underline font-medium">Create Assessment</button> to generate your first test paper.
                    </td>
                  </tr>
                ) : (
                  exams.map((exam) => {
                    const parsedQuestions = exam.questions_json ? JSON.parse(exam.questions_json) : [];
                    const sched = getExamScheduleInfo(exam);
                    return (
                      <tr key={exam.id} className="hover:bg-[#F0ECE4]/40 dark:hover:bg-[#1D1B19]/40 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-[#242321] dark:text-[#F5F5F4]">
                          <div>{exam.name}</div>
                          <div className="text-[11px] font-mono text-[#716D67] font-normal mt-0.5">Code: {exam.exam_code}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${sched.dot}`} />
                            <span className="font-medium text-[#242321] dark:text-[#F5F5F4]">{sched.label}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[#716D67] dark:text-[#A8A29E]">
                          {parsedQuestions.length} items
                        </td>
                        <td className="py-3.5 px-4 text-[#716D67] dark:text-[#A8A29E]">
                          {exam.total_marks}
                        </td>
                        <td className="py-3.5 px-4 text-[#716D67] dark:text-[#A8A29E]">
                          {exam.duration_minutes} min
                        </td>
                        <td className="py-3.5 px-4 text-[#716D67] dark:text-[#A8A29E]">
                          {exam.start_time ? new Date(exam.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : "Immediate"}
                        </td>
                        <td className="py-3.5 px-4 text-right relative">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Preview Question Paper Modal Button */}
                            <button
                              type="button"
                              onClick={() => setPreviewExam(exam)}
                              className="p-1.5 rounded border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#C84B18] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] transition-all"
                              title="Preview Generated Exam Paper"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>

                            {/* End Early Button (if active & published) */}
                            {exam.is_published && (!sched || sched.status === "live" || sched.status === "scheduled") && (
                              <button
                                type="button"
                                onClick={() => handleEndExamEarly(exam.id, exam.name)}
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
                                onClick={() => handlePublishExam(exam.id)}
                                className="px-2 py-1 rounded bg-[#C84B18] text-white dark:bg-[#EA580C] text-[10px] font-semibold hover:opacity-90 transition-all flex items-center gap-1"
                                title="Publish Assessment Live to Students"
                              >
                                <Sparkles className="h-3 w-3" />
                                <span>Publish</span>
                              </button>
                            )}

                            <a
                              href={`http://localhost:8000/api/v1/exams/${exam.id}/pdf/question-paper`}
                              target="_blank" rel="noreferrer"
                              className="p-1.5 rounded border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524]"
                              title="Print Question Paper PDF"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </a>

                            <button
                              onClick={() => {
                                handleGenerateCredentials(exam.id, exam.name);
                                handleDownloadCredentialsCSV(exam.id, exam.name);
                              }}
                              className="p-1.5 rounded border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#C84B18] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524]"
                              title="Send Student Passcodes & Credentials"
                            >
                              <Key className="h-3.5 w-3.5" />
                            </button>

                            <button
                              onClick={() => setQrModalExam(exam)}
                              className="p-1.5 rounded border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524]"
                              title="Display QR Code"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                            </button>

                            {deleteConfirmId === exam.id ? (
                              <div className="flex items-center gap-1">
                                <button 
                                  type="button"
                                  onClick={() => handleDeleteExam(exam.id)} 
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer"
                                  title="Permanently Delete Assessment"
                                >
                                  Delete
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)} 
                                  className="px-1.5 py-1 bg-[#E5E0D8] dark:bg-[#292524] text-[#242321] dark:text-[#F5F5F4] rounded text-[10px] font-medium hover:opacity-80"
                                  title="Cancel"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button 
                                type="button"
                                onClick={() => setDeleteConfirmId(exam.id)} 
                                className="p-1.5 rounded text-[#716D67] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" 
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
        </div>
      )}

      {/* ═══════ TAB 2: MULTI-STEP ASSESSMENT CREATION WORKFLOW WIZARD ═══════ */}
      {activeTab === "create" && (
        <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-6 space-y-6">
          {/* Stepper Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E0D8] dark:border-[#292524]">
            <div className="flex items-center space-x-4 sm:space-x-6 text-xs font-semibold overflow-x-auto pb-1 sm:pb-0 scrollbar-none whitespace-nowrap">
              {[
                { step: 1, label: "01 Content" },
                { step: 2, label: "02 Questions" },
                { step: 3, label: "03 Rules" },
                { step: 4, label: "04 Review" }
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setCreateStep(s.step as any)}
                  className={`flex items-center gap-1.5 pb-1 border-b-2 transition-all shrink-0 ${
                    createStep === s.step
                      ? "border-[#C84B18] text-[#C84B18] dark:border-[#EA580C] dark:text-[#EA580C]"
                      : createStep > s.step
                      ? "border-emerald-600 text-emerald-600"
                      : "border-transparent text-[#716D67] hover:text-[#242321]"
                  }`}
                >
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
            <span className="text-xs text-[#716D67] self-end sm:self-auto font-medium">Step {createStep} of 4</span>
          </div>

          <form onSubmit={handleCreateExam} className="space-y-5">
            {/* STEP 1: CONTENT SOURCE */}
            {createStep === 1 && (
              <div className="space-y-4 max-w-xl">
                <div className="space-y-1.5">
                  <label className={labelCls}>Knowledge Source</label>
                  {kbSubjects.length > 0 ? (
                    <select
                      required
                      value={examSubject}
                      onChange={(e) => setExamSubject(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Select Knowledge Source...</option>
                      {kbSubjects.map((s) => (
                        <option key={s.subject_id} value={s.subject_id}>
                          {s.name} ({s.document_count} document{s.document_count > 1 ? "s" : ""})
                        </option>
                      ))}
                      <option value="general_101">General Knowledge Base</option>
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
                  <p className="text-[11px] text-[#716D67]">Questions will be strictly generated using documents in this knowledge source.</p>
                </div>

                <div className="space-y-1.5">
                  <label className={labelCls}>Assessment Title</label>
                  <input type="text" required value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="e.g. Unit 4 Thermodynamics Examination" className={inputCls} />
                </div>

                <div className="space-y-1.5">
                  <label className={labelCls}>Topic Keyword</label>
                  <input type="text" value={examTopic} onChange={(e) => setExamTopic(e.target.value)} placeholder="e.g. Heat Transfer, Entropy" className={inputCls} />
                </div>

                <div className="pt-4 flex justify-end">
                  <button type="button" onClick={() => setCreateStep(2)} className="btn-primary flex items-center gap-1.5">
                    <span>Next: Questions</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: QUESTIONS CONFIG */}
            {createStep === 2 && (
              <div className="space-y-4 max-w-xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelCls}>Question Format</label>
                    <select value={questionType} onChange={(e: any) => setQuestionType(e.target.value)} className={inputCls}>
                      <option value="mcq">Multiple Choice (MCQ)</option>
                      <option value="subjective">Subjective / Descriptive</option>
                      <option value="tf">True / False</option>
                      <option value="mixed">Mixed (MCQ + Subjective)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>Difficulty Level</label>
                    <select value={difficulty} onChange={(e: any) => setDifficulty(e.target.value)} className={inputCls}>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                {/* Conditional Question Count Controls */}
                {questionType === "mcq" && (
                  <div className="space-y-1.5">
                    <label className={labelCls}>Number of Multiple Choice Questions (MCQs)</label>
                    <input 
                      type="number" 
                      value={numMcq} 
                      onChange={(e) => setNumMcq(e.target.value)} 
                      min="1" 
                      max="50" 
                      className={inputCls} 
                    />
                    <p className="text-[11px] text-[#716D67]">Each question will have 4 domain-specific options with single correct answer.</p>
                  </div>
                )}

                {questionType === "tf" && (
                  <div className="space-y-1.5">
                    <label className={labelCls}>Number of True / False Questions</label>
                    <input 
                      type="number" 
                      value={numMcq} 
                      onChange={(e) => setNumMcq(e.target.value)} 
                      min="1" 
                      max="50" 
                      className={inputCls} 
                    />
                  </div>
                )}

                {questionType === "subjective" && (
                  <div className="space-y-1.5">
                    <label className={labelCls}>Number of Subjective Questions</label>
                    <input 
                      type="number" 
                      value={numSubjective || "5"} 
                      onChange={(e) => setNumSubjective(e.target.value)} 
                      min="1" 
                      max="20" 
                      className={inputCls} 
                    />
                    <p className="text-[11px] text-[#716D67]">Students will provide descriptive answers evaluated against rubric key concepts.</p>
                  </div>
                )}

                {questionType === "mixed" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className={labelCls}>No. of MCQs</label>
                      <input type="number" value={numMcq} onChange={(e) => setNumMcq(e.target.value)} min="1" max="40" className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelCls}>No. of Subjective</label>
                      <input type="number" value={numSubjective || "2"} onChange={(e) => setNumSubjective(e.target.value)} min="1" max="15" className={inputCls} />
                    </div>
                  </div>
                )}

                <div className="pt-4 flex justify-between">
                  <button type="button" onClick={() => setCreateStep(1)} className="px-4 py-2 border border-[#E5E0D8] dark:border-[#292524] rounded-md text-xs font-medium text-[#716D67] hover:text-[#242321] flex items-center gap-1.5">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back</span>
                  </button>
                  <button type="button" onClick={() => setCreateStep(3)} className="btn-primary flex items-center gap-1.5">
                    <span>Next: Rules</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: RULES & SCHEDULING */}
            {createStep === 3 && (
              <div className="space-y-4 max-w-xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelCls}>Duration (Minutes)</label>
                    <input type="number" value={examDuration} onChange={(e) => setExamDuration(e.target.value)} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>Total Marks</label>
                    <input type="number" value={examMarks} onChange={(e) => setExamMarks(e.target.value)} className={inputCls} />
                  </div>
                </div>

                {/* Presets */}
                <div className="space-y-2 pt-2">
                  <label className={labelCls}>Schedule Window Presets</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSchedulePreset("now")} className="px-2.5 py-1 text-xs border border-[#E5E0D8] dark:border-[#292524] rounded-md hover:bg-[#F0ECE4] dark:hover:bg-[#1D1B19]">Start Now</button>
                    <button type="button" onClick={() => setSchedulePreset("today4pm")} className="px-2.5 py-1 text-xs border border-[#E5E0D8] dark:border-[#292524] rounded-md hover:bg-[#F0ECE4] dark:hover:bg-[#1D1B19]">Today 4 PM</button>
                    <button type="button" onClick={() => setSchedulePreset("tomorrow10am")} className="px-2.5 py-1 text-xs border border-[#E5E0D8] dark:border-[#292524] rounded-md hover:bg-[#F0ECE4] dark:hover:bg-[#1D1B19]">Tomorrow 10 AM</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelCls}>Start Date & Time</label>
                    <input type="datetime-local" value={examStartDate} onChange={(e) => setExamStartDate(e.target.value)} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>End Date & Time</label>
                    <input type="datetime-local" value={examEndDate} onChange={(e) => setExamEndDate(e.target.value)} className={inputCls} />
                  </div>
                </div>

                <div className="pt-4 flex justify-between">
                  <button type="button" onClick={() => setCreateStep(2)} className="px-4 py-2 border border-[#E5E0D8] dark:border-[#292524] rounded-md text-xs font-medium text-[#716D67] hover:text-[#242321] flex items-center gap-1.5">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back</span>
                  </button>
                  <button type="button" onClick={() => setCreateStep(4)} className="btn-primary flex items-center gap-1.5">
                    <span>Next: Review</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW & GENERATE */}
            {createStep === 4 && (
              <div className="space-y-4 max-w-xl">
                <div className="bg-[#F0ECE4] dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] rounded-md p-4 space-y-2 text-xs">
                  <h3 className="font-semibold text-[#242321] dark:text-[#F5F5F4] text-sm">Assessment Blueprint Summary</h3>
                  <div className="grid grid-cols-2 gap-2 text-[#716D67] dark:text-[#A8A29E]">
                    <div>Title: <b className="text-[#242321] dark:text-[#F5F5F4]">{examName || "Untitled Assessment"}</b></div>
                    <div>Source: <b className="text-[#242321] dark:text-[#F5F5F4]">{examSubject || "General"}</b></div>
                    <div>Questions: <b className="text-[#242321] dark:text-[#F5F5F4]">{parseInt(numMcq) + parseInt(numSubjective)} Total ({numMcq} MCQ)</b></div>
                    <div>Duration: <b className="text-[#242321] dark:text-[#F5F5F4]">{examDuration} min</b></div>
                    <div>Marks: <b className="text-[#242321] dark:text-[#F5F5F4]">{examMarks}</b></div>
                    <div>Difficulty: <b className="text-[#242321] dark:text-[#F5F5F4] uppercase">{difficulty}</b></div>
                  </div>
                </div>

                <div className="pt-4 flex justify-between">
                  <button type="button" onClick={() => setCreateStep(3)} className="px-4 py-2 border border-[#E5E0D8] dark:border-[#292524] rounded-md text-xs font-medium text-[#716D67] hover:text-[#242321] flex items-center gap-1.5">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back</span>
                  </button>
                  <button type="submit" disabled={isGenerating} className="btn-primary flex items-center gap-2">
                    {isGenerating ? (
                      <>
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <span>Synthesizing Exam Paper...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>Generate & Publish Assessment</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* ═══════ TAB 3: KNOWLEDGE SOURCES ═══════ */}
      {activeTab === "kb" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#C84B18]" />
              <span>Upload Knowledge Document</span>
            </h2>
            <form onSubmit={handleUploadKB} className="space-y-3">
              <div className="space-y-1">
                <label className={labelCls}>Subject Code</label>
                <input type="text" value={kbSubjectId} onChange={(e) => setKbSubjectId(e.target.value)} placeholder="e.g. biology_101" className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Document File (PDF, Text, Docx)</label>
                <input type="file" required onChange={(e) => setKbFile(e.target.files?.[0] || null)} className="w-full text-xs text-[#716D67] file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[#F0ECE4] file:text-[#242321]" />
              </div>
              <button type="submit" className="btn-primary w-full">Index Material into Vector DB</button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#242321] dark:text-[#F5F5F4]">Indexed Knowledge Sources</h2>
              <span className="text-xs text-[#716D67]">{documents.length} documents</span>
            </div>
            <div className="divide-y divide-[#E5E0D8] dark:divide-[#292524]">
              {documents.length === 0 ? (
                <div className="py-8 text-center text-[#716D67] text-xs">No documents uploaded yet.</div>
              ) : documents.map((doc) => (
                <div key={doc.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-[#242321] dark:text-[#F5F5F4]">{doc.filename}</div>
                    <div className="text-[11px] text-[#716D67]">Subject: {doc.subject_id} · Version {doc.version}</div>
                  </div>
                  <span className="text-[11px] font-mono text-[#716D67]">{doc.chunk_count} Chunks</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ TAB 4: STUDENT ROSTER ═══════ */}
      {activeTab === "students" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
                <Users className="h-4 w-4 text-[#C84B18]" />
                <span>Add Student Profile</span>
              </h2>
              <form onSubmit={handleAddStudent} className="space-y-3">
                <div className="space-y-1"><label className={labelCls}>Full Name</label><input type="text" required value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Alex Johnson" className={inputCls} /></div>
                <div className="space-y-1"><label className={labelCls}>Email Address</label><input type="email" required value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} placeholder="alex@institution.edu" className={inputCls} /></div>
                <div className="space-y-1"><label className={labelCls}>Roll Number</label><input type="text" required value={studentRoll} onChange={(e) => setStudentRoll(e.target.value)} placeholder="CS-2024-001" className={inputCls} /></div>
                <button type="submit" className="btn-primary w-full">Create Student Record</button>
              </form>
            </div>

            <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[#242321] dark:text-[#F5F5F4]">Bulk CSV Import</h2>
              <form onSubmit={handleImportCSV} className="space-y-3">
                <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} className="text-xs text-[#716D67]" />
                <button type="submit" disabled={!csvFile || isImporting} className="px-4 py-2 border border-[#E5E0D8] dark:border-[#292524] rounded-md text-xs font-medium w-full">
                  {isImporting ? "Importing..." : "Import Students CSV"}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-7 bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E0D8] dark:border-[#292524]">
              <div>
                <h2 className="text-sm font-semibold text-[#242321] dark:text-[#F5F5F4]">Enrolled Student Directory</h2>
                <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-0.5">Manage student profiles, specifications, and roster enrollment.</p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#E5E0D8]/50 dark:bg-[#292524] text-[#716D67] dark:text-[#A8A29E]">{students.length} students</span>
            </div>
            
            <div className="divide-y divide-[#E5E0D8] dark:divide-[#292524]">
              {students.length === 0 ? (
                <div className="py-8 text-center text-[#716D67] dark:text-[#A8A29E] text-xs">No students enrolled yet. Use the form on the left to add your first student.</div>
              ) : (
                students.map((st) => (
                  <div key={st.id} className="py-3 flex items-center justify-between text-xs hover:bg-[#F0ECE4]/30 dark:hover:bg-[#1D1B19]/30 px-2 rounded-md transition-colors">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#242321] dark:text-[#F5F5F4] text-xs">{st.full_name}</span>
                        {st.is_verified ? (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            <span>Authorized</span>
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Pending Auth</span>
                          </span>
                        )}
                        {st.division && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] font-medium">
                            Div {st.division}
                          </span>
                        )}
                        {st.batch && (
                          <span className="text-[10px] text-[#716D67] dark:text-[#A8A29E]">
                            Batch: {st.batch}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#716D67] dark:text-[#A8A29E] flex items-center gap-2 font-mono">
                        <span>{st.email}</span>
                        <span>•</span>
                        <span>Roll: {st.roll_number}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {deletingStudentId === st.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteStudent(st.id)}
                            className="px-2 py-1 bg-rose-600 text-white rounded text-[11px] font-semibold hover:bg-rose-700 transition-all"
                          >
                            Confirm Delete
                          </button>
                          <button
                            onClick={() => setDeletingStudentId(null)}
                            className="px-2 py-1 bg-[#E5E0D8] dark:bg-[#292524] text-[#242321] dark:text-[#F5F5F4] rounded text-[11px] hover:bg-[#E5E0D8]/80 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          {!st.is_verified && (
                            <button
                              onClick={() => handleResendAuth(st.id)}
                              className="p-1.5 rounded border border-[#E5E0D8] dark:border-[#292524] text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-all"
                              title="Resend Authorization Email"
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => openEditStudent(st)}
                            className="p-1.5 rounded border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#C84B18] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] transition-all"
                            title="Edit Student Specifications"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingStudentId(st.id)}
                            className="p-1.5 rounded border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                            title="Delete Student from Directory"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ TAB 5: QUIZ-WISE GENERALIZED CLASS SUMMARY ═══════ */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          
          {/* Top Bar: Quiz Selector & 1-Click CSV Export */}
          <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-[#C84B18]" />
                  <span>Generalized Classroom Quiz Analytics</span>
                </h2>
                <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-0.5">
                  Select a quiz to view generalized cohort performance, score distributions, and individual student results.
                </p>
              </div>

              {reportAnalytics && (
                <button
                  onClick={() => handleDownloadGradebookCSV(reportAnalytics.exam_id, reportAnalytics.exam_name)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#E5E0D8] dark:border-[#292524] hover:bg-[#F0ECE4]/60 dark:hover:bg-[#292524] text-xs font-semibold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-1.5 self-start sm:self-auto transition-all shadow-xs"
                >
                  <Download className="h-3.5 w-3.5 text-[#C84B18]" />
                  <span>Export Gradebook CSV</span>
                </button>
              )}
            </div>

            {/* Assessment Selector Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-t border-[#E5E0D8] dark:border-[#292524]">
              {exams.length === 0 ? (
                <div className="text-xs text-[#716D67] py-2">No assessments created yet.</div>
              ) : (
                exams.map((ex) => {
                  const isSelected = ex.id === selectedReportExamId;
                  return (
                    <button
                      key={ex.id}
                      onClick={() => loadExamAnalytics(ex.id)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold shrink-0 transition-all border ${
                        isSelected
                          ? "bg-[#C84B18] text-white border-[#C84B18] shadow-xs"
                          : "bg-[#F0ECE4]/40 dark:bg-[#1D1B19] border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{ex.name}</span>
                        <span className="text-[10px] opacity-75 font-mono">({ex.code})</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {loadingReport ? (
            <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-[#C84B18] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-[#716D67] font-medium">Computing Classroom Analytics & Distributions...</p>
            </div>
          ) : reportAnalytics ? (
            <div className="space-y-6">

              {/* ════ Generalized Summary Metric KPI Cards ════ */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 shadow-xs">
                  <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">Attendance</div>
                  <div className="text-2xl font-bold text-[#242321] dark:text-[#F5F5F4] mt-1">
                    {reportAnalytics.attended_count} <span className="text-xs text-[#716D67] font-normal">/ {reportAnalytics.total_enrolled}</span>
                  </div>
                  <div className="text-[10px] text-[#716D67] mt-0.5">{reportAnalytics.attendance_rate}% Participation</div>
                </div>

                <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 shadow-xs">
                  <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">Class Average</div>
                  <div className="text-2xl font-bold text-[#C84B18] dark:text-[#EA580C] mt-1">
                    {reportAnalytics.average_score} <span className="text-xs text-[#716D67] font-normal">/ {reportAnalytics.total_marks}</span>
                  </div>
                  <div className="text-[10px] text-[#716D67] mt-0.5">{reportAnalytics.average_percentage}% Average</div>
                </div>

                <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 shadow-xs">
                  <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">Pass Rate</div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {reportAnalytics.pass_rate}%
                  </div>
                  <div className="text-[10px] text-[#716D67] mt-0.5">{reportAnalytics.pass_count} Passed · {reportAnalytics.fail_count} Failed</div>
                </div>

                <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 shadow-xs">
                  <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">Highest Score</div>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                    {reportAnalytics.highest_score}
                  </div>
                  <div className="text-[10px] text-[#716D67] mt-0.5">Top candidate score</div>
                </div>

                <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 shadow-xs col-span-2 lg:col-span-1">
                  <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">Lowest Score</div>
                  <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                    {reportAnalytics.lowest_score}
                  </div>
                  <div className="text-[10px] text-[#716D67] mt-0.5">Passing: {reportAnalytics.passing_marks} Marks</div>
                </div>
              </div>

              {/* ════ Score Distribution & Topic Difficulty Analysis ════ */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Score Distribution Brackets */}
                <div className="lg:col-span-6 bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-5 space-y-4 shadow-xs">
                  <h3 className="text-sm font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-[#C84B18]" />
                    <span>Cohort Score Distribution</span>
                  </h3>

                  <div className="space-y-3 pt-1 text-xs">
                    {[
                      { label: "80% - 100% (Distinction)", count: reportAnalytics.distribution?.["80_100"] || 0, color: "bg-emerald-500" },
                      { label: "60% - 79% (Proficient)", count: reportAnalytics.distribution?.["60_80"] || 0, color: "bg-blue-500" },
                      { label: "40% - 59% (Passing)", count: reportAnalytics.distribution?.["40_60"] || 0, color: "bg-amber-500" },
                      { label: "0% - 39% (Needs Improvement)", count: reportAnalytics.distribution?.["0_40"] || 0, color: "bg-rose-500" }
                    ].map((bracket) => {
                      const total = reportAnalytics.attended_count || 1;
                      const pct = Math.round((bracket.count / total) * 100);
                      return (
                        <div key={bracket.label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-[#242321] dark:text-[#F5F5F4]">{bracket.label}</span>
                            <span className="font-bold text-[#716D67] dark:text-[#A8A29E]">{bracket.count} students ({pct}%)</span>
                          </div>
                          <div className="w-full bg-[#E5E0D8] dark:bg-[#292524] h-2.5 rounded-full overflow-hidden">
                            <div className={`h-full ${bracket.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Topic Difficulty & Error Trends */}
                <div className="lg:col-span-6 bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-5 space-y-4 shadow-xs">
                  <h3 className="text-sm font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-[#C84B18]" />
                    <span>Topic Difficulty & Accuracy Trends</span>
                  </h3>

                  <div className="space-y-3 pt-1 text-xs">
                    {reportAnalytics.topic_analytics && reportAnalytics.topic_analytics.length > 0 ? (
                      reportAnalytics.topic_analytics.map((t: any) => (
                        <div key={t.topic} className="p-3 rounded-lg bg-[#F0ECE4]/40 dark:bg-[#1D1B19]/50 border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#242321] dark:text-[#F5F5F4]">{t.topic}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              t.accuracy >= 75 
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : t.accuracy >= 50
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                            }`}>
                              {t.accuracy}% Class Accuracy ({t.difficulty})
                            </span>
                          </div>
                          <div className="w-full bg-[#E5E0D8] dark:bg-[#292524] h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                t.accuracy >= 75 ? "bg-emerald-500" : t.accuracy >= 50 ? "bg-amber-500" : "bg-rose-500"
                              }`}
                              style={{ width: `${t.accuracy}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-[#716D67] py-6 text-center">
                        Topic analysis will populate as student submissions are recorded.
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* ════ Student Performance Roster Table ════ */}
              <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-[#C84B18]" />
                      <span>Student Results & Proctoring Audit</span>
                    </h3>
                    <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-0.5">
                      Individual student rankings, earned marks, and anti-cheat telemetry.
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[#E5E0D8]/60 dark:bg-[#292524] text-[#716D67] dark:text-[#A8A29E]">
                    {reportAnalytics.submissions?.length || 0} Submissions
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E]">
                        <th className="py-2.5 px-3 font-semibold">Rank</th>
                        <th className="py-2.5 px-3 font-semibold">Candidate</th>
                        <th className="py-2.5 px-3 font-semibold">Roll Number</th>
                        <th className="py-2.5 px-3 font-semibold">Score</th>
                        <th className="py-2.5 px-3 font-semibold">Percentage</th>
                        <th className="py-2.5 px-3 font-semibold">Result</th>
                        <th className="py-2.5 px-3 font-semibold">Proctor Flags</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E0D8] dark:divide-[#292524]">
                      {reportAnalytics.submissions && reportAnalytics.submissions.length > 0 ? (
                        reportAnalytics.submissions.map((sub: any) => (
                          <tr key={sub.submission_id} className="hover:bg-[#F0ECE4]/30 dark:hover:bg-[#1D1B19]/30 transition-colors">
                            <td className="py-3 px-3 font-bold font-mono">
                              #{sub.rank}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-[#242321] dark:text-[#F5F5F4]">{sub.student_name}</div>
                              <div className="text-[11px] text-[#716D67]">{sub.email}</div>
                            </td>
                            <td className="py-3 px-3 font-mono text-[#716D67]">
                              {sub.roll_number || "N/A"}
                            </td>
                            <td className="py-3 px-3 font-bold text-[#242321] dark:text-[#F5F5F4]">
                              {sub.score} / {sub.max_score}
                            </td>
                            <td className="py-3 px-3 font-bold text-[#C84B18] dark:text-[#EA580C]">
                              {sub.percentage}%
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                sub.is_passed
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                              }`}>
                                {sub.is_passed ? "PASSED" : "FAILED"}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {sub.proctor_alerts > 0 ? (
                                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 text-[10px] font-semibold border border-rose-200">
                                  {sub.proctor_alerts} Incident{sub.proctor_alerts > 1 ? "s" : ""}
                                </span>
                              ) : (
                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Clean</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => inspectStudentAnswerSheet(sub.submission_id)}
                                className="px-2.5 py-1 rounded border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#C84B18] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] text-[11px] font-semibold transition-all"
                              >
                                View Sheet
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-xs text-[#716D67]">
                            No student attempts submitted for this quiz yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : null}

        </div>
      )}

      {/* ═══════ STUDENT ANSWER SHEET INSPECTION MODAL ═══════ */}
      {studentAnswerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] rounded-lg">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#242321] dark:text-[#F5F5F4]">
                    Student Evaluation Sheet — {studentAnswerModal.exam_name}
                  </h3>
                  <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                    Score: <b className="text-[#C84B18]">{studentAnswerModal.score} / {studentAnswerModal.max_score} ({studentAnswerModal.percentage}%)</b>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStudentAnswerModal(null)}
                className="p-1.5 rounded-lg text-[#716D67] hover:bg-[#E5E0D8]/50 dark:hover:bg-[#292524]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Questions Breakdown List */}
            <div className="overflow-y-auto space-y-4 pr-1 text-xs">
              {studentAnswerModal.questions && studentAnswerModal.questions.length > 0 ? (
                studentAnswerModal.questions.map((q: any, idx: number) => {
                  const isCorrect = q.is_correct;
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                        isCorrect
                          ? "bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50"
                          : "bg-rose-50/30 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-[#716D67]">Q{idx + 1}. {q.question_text || q.question}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}>
                          {q.score_awarded ?? (isCorrect ? q.marks : 0)} / {q.marks || 1}
                        </span>
                      </div>

                      <div className="pl-4 space-y-1 text-[11px]">
                        <div><b>Student Answer:</b> <span className="font-mono">{String(q.user_answer || "No response")}</span></div>
                        <div><b>Correct Answer:</b> <span className="font-mono text-emerald-700 dark:text-emerald-300 font-bold">{String(q.correct_answer)}</span></div>
                        {q.explanation && (
                          <div className="text-[#716D67] pt-1"><b>Explanation:</b> {q.explanation}</div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-[#716D67]">No question evaluations found.</div>
              )}
            </div>

            <div className="pt-3 border-t border-[#E5E0D8] dark:border-[#292524] flex justify-end shrink-0">
              <button
                onClick={() => setStudentAnswerModal(null)}
                className="btn-primary px-5"
              >
                Close Sheet
              </button>
            </div>

          </div>
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

      {/* ═══════ EDIT STUDENT SPECIFICATIONS MODAL ═══════ */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-lg max-w-lg w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] rounded-md">
                  <Pencil className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#242321] dark:text-[#F5F5F4]">Edit Student Specifications</h3>
                  <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">Update student profile and academic roster details.</p>
                </div>
              </div>
              <button
                onClick={() => setEditingStudent(null)}
                className="p-1.5 rounded-md text-[#716D67] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStudent} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className={labelCls}>Full Name</label>
                <input
                  type="text"
                  required
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="space-y-1">
                <label className={labelCls}>Email Address</label>
                <input
                  type="email"
                  required
                  value={editStudentEmail}
                  onChange={(e) => setEditStudentEmail(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className={labelCls}>Roll Number</label>
                  <input
                    type="text"
                    required
                    value={editStudentRoll}
                    onChange={(e) => setEditStudentRoll(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Division / Section</label>
                  <input
                    type="text"
                    value={editStudentDivision}
                    onChange={(e) => setEditStudentDivision(e.target.value)}
                    placeholder="e.g. A"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Batch / Year</label>
                  <input
                    type="text"
                    value={editStudentBatch}
                    onChange={(e) => setEditStudentBatch(e.target.value)}
                    placeholder="e.g. 2024-2028"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-[#E5E0D8] dark:border-[#292524]">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-md border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStudent}
                  className="btn-primary flex-1 text-center"
                >
                  {isUpdatingStudent ? "Saving Changes..." : "Save Specifications"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════ GENERATED EXAM PREVIEW WINDOW / MODAL ═══════ */}
      {previewExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-4 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] border border-[#C84B18]/20">
                    Exam Paper Preview
                  </span>
                  {previewExam.is_published ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
                      Live / Published
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200">
                      Draft (Unpublished)
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-[#242321] dark:text-[#F5F5F4]">{previewExam.name}</h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#716D67] dark:text-[#A8A29E] font-mono">
                  <span>Code: <b className="text-[#C84B18] dark:text-[#EA580C]">{previewExam.exam_code}</b></span>
                  <span>•</span>
                  <span>Duration: {previewExam.duration_minutes} mins</span>
                  <span>•</span>
                  <span>Total Marks: {previewExam.total_marks}</span>
                  <span>•</span>
                  <span>Passing: {previewExam.passing_marks}</span>
                </div>
              </div>

              <button
                onClick={() => setPreviewExam(null)}
                className="p-1.5 rounded-md text-[#716D67] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Questions Scrollable Body */}
            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              {(() => {
                let parsedQuestions: any[] = [];
                try {
                  parsedQuestions = typeof previewExam.questions_json === "string" 
                    ? JSON.parse(previewExam.questions_json) 
                    : (previewExam.questions_json || []);
                } catch {
                  parsedQuestions = [];
                }

                if (parsedQuestions.length === 0) {
                  return (
                    <div className="py-12 text-center text-xs text-[#716D67] dark:text-[#A8A29E]">
                      No questions found in this assessment paper.
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#716D67] dark:text-[#A8A29E]">
                      <span>{parsedQuestions.length} Questions Generated</span>
                      <span>Total Marks: {previewExam.total_marks}</span>
                    </div>

                    {parsedQuestions.map((q: any, idx: number) => {
                      const isMcq = q.question_type === "mcq" || q.type === "mcq" || (q.options && q.options.length > 0);
                      return (
                        <div
                          key={idx}
                          className="bg-[#F0ECE4]/40 dark:bg-[#1D1B19]/50 border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="h-6 w-6 rounded-md bg-[#C84B18] dark:bg-[#EA580C] text-white font-bold text-xs flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#E5E0D8]/60 dark:bg-[#292524] text-[#716D67] dark:text-[#A8A29E]">
                                {isMcq ? "Multiple Choice" : "Subjective"}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-[#716D67] dark:text-[#A8A29E]">
                              {q.marks || 1} Marks
                            </span>
                          </div>

                          {/* Question Text */}
                          <p className="text-xs font-semibold text-[#242321] dark:text-[#F5F5F4] leading-relaxed">
                            {q.question_text || q.text || q.question}
                          </p>

                          {/* MCQ Options */}
                          {isMcq && q.options && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {q.options.map((opt: string, optIdx: number) => {
                                const optLetter = String.fromCharCode(65 + optIdx);
                                const isCorrect = q.correct_option === optLetter || q.correct_answer === optLetter || q.correct_answer === opt;
                                return (
                                  <div
                                    key={optIdx}
                                    className={`px-3 py-2 rounded-md border text-xs flex items-center gap-2 transition-all ${
                                      isCorrect
                                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-semibold"
                                        : "bg-[#FFFFFF] dark:bg-[#171615] border-[#E5E0D8] dark:border-[#292524] text-[#242321] dark:text-[#F5F5F4]"
                                    }`}
                                  >
                                    <span className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                      isCorrect
                                        ? "bg-emerald-600 text-white"
                                        : "bg-[#E5E0D8] dark:bg-[#292524] text-[#716D67] dark:text-[#A8A29E]"
                                    }`}>
                                      {optLetter}
                                    </span>
                                    <span className="truncate">{opt}</span>
                                    {isCorrect && <Check className="h-3.5 w-3.5 text-emerald-600 ml-auto shrink-0" />}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Explanation / Solution */}
                          {q.explanation && (
                            <div className="p-2.5 rounded-md bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-[11px] text-[#716D67] dark:text-[#A8A29E] space-y-1">
                              <span className="font-semibold text-[#242321] dark:text-[#F5F5F4]">Solution / Rationale:</span>
                              <p>{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E5E0D8] dark:border-[#292524] shrink-0">
              <div className="flex items-center gap-2">
                <a
                  href={`http://localhost:8000/api/v1/exams/${previewExam.id}/pdf/question-paper`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-md border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] text-xs font-medium flex items-center gap-1.5 hover:bg-[#E5E0D8]/40"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Paper PDF</span>
                </a>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewExam(null)}
                  className="px-4 py-2 rounded-md border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] text-xs font-medium"
                >
                  Close Preview
                </button>

                {previewExam.is_published && (
                  <button
                    type="button"
                    onClick={() => handleEndExamEarly(previewExam.id, previewExam.name)}
                    className="px-3 py-2 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <StopCircle className="h-3.5 w-3.5" />
                    <span>End Assessment Early</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Permanently delete assessment "${previewExam.name}"?`)) {
                      handleDeleteExam(previewExam.id);
                    }
                  }}
                  className="px-3 py-2 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>

                {!previewExam.is_published && (
                  <button
                    type="button"
                    onClick={() => handlePublishExam(previewExam.id)}
                    className="btn-primary flex items-center gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Publish Assessment Live</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "../../../store/authStore";
import { useToast } from "../../../components/Toast";
import { apiFetch, API_V1, getFrontendBaseUrl, getWebSocketUrl } from "../../../lib/api";
import { 
  Upload, Plus, FileSpreadsheet, BookOpen, Cpu, Calendar, Lock, ChevronRight, 
  Clipboard, Check, Download, Users, LineChart, Eye, Trash2, AlertCircle,
  Sparkles, Key, Trophy, Share2, FileText, Printer, Copy, BarChart3, 
  GraduationCap, FolderOpen, Clock, QrCode, X, ArrowRight, ArrowLeft, Pencil, Mail, CheckCircle, StopCircle,
  RefreshCw, Save, ShieldAlert, Radio, Edit3, ExternalLink
} from "lucide-react";
import MathText from "../../../components/MathText";

export default function TeacherDashboard() {
  const { token, fullName } = useAuthStore();
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<"exams" | "create" | "students" | "kb" | "reports" | "bank">("exams");
  
  useEffect(() => {
    const syncTab = () => {
      const hash = window.location.hash.replace("#", "");
      if (["exams", "create", "kb", "students", "reports", "bank"].includes(hash)) {
        setActiveTab(hash as any);
      }
    };
    syncTab();
    const handleCustom = (e: any) => {
      if (e.detail && ["exams", "create", "kb", "students", "reports", "bank"].includes(e.detail)) {
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
  const [isEditingPaper, setIsEditingPaper] = useState(false);
  const [editedQuestions, setEditedQuestions] = useState<any[]>([]);
  const [rerollingIdx, setRerollingIdx] = useState<number | null>(null);
  const [isSavingPaper, setIsSavingPaper] = useState(false);

  // Live Proctoring Command Center
  const [liveProctorExam, setLiveProctorExam] = useState<any | null>(null);
  const [liveProctorAlerts, setLiveProctorAlerts] = useState<any[]>([]);
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
  const [examDocumentId, setExamDocumentId] = useState("");
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

  // Question Bank Studio State
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [bankSearch, setBankSearch] = useState("");
  const [bankDifficulty, setBankDifficulty] = useState("");
  const [bankSubject, setBankSubject] = useState("");
  const [loadingBank, setLoadingBank] = useState(false);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [newBankText, setNewBankText] = useState("");
  const [newBankType, setNewBankType] = useState("MCQ");
  const [newBankCorrect, setNewBankCorrect] = useState("");
  const [newBankOptions, setNewBankOptions] = useState(["", "", "", ""]);
  const [newBankDiff, setNewBankDiff] = useState("medium");
  const [newBankTopic, setNewBankTopic] = useState("General");
  const [newBankSubjectId, setNewBankSubjectId] = useState("");

  const fetchBankQuestions = async () => {
    try {
      setLoadingBank(true);
      let url = "/kb/questions/bank?";
      if (bankSubject) url += `subject_id=${bankSubject}&`;
      if (bankDifficulty) url += `difficulty=${bankDifficulty}&`;
      if (bankSearch) url += `search=${encodeURIComponent(bankSearch)}&`;
      const res = await apiFetch(url, { token });
      if (res.ok) setBankQuestions(await res.json());
    } catch {} finally {
      setLoadingBank(false);
    }
  };

  const handleCreateBankQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch("/kb/questions/bank", {
        token,
        method: "POST",
        body: JSON.stringify({
          subject_id: newBankSubjectId || (kbSubjects[0]?.id || null),
          question_type: newBankType,
          question_text: newBankText,
          options_json: JSON.stringify(newBankOptions),
          correct_answer: newBankCorrect,
          difficulty: newBankDiff,
          topic: newBankTopic,
          bloom_level: "applying"
        })
      });
      if (res.ok) {
        showToast("Question added to Question Bank", "success");
        setShowAddBankModal(false);
        setNewBankText("");
        setNewBankCorrect("");
        fetchBankQuestions();
      }
    } catch {}
  };

  useEffect(() => {
    if (token) { fetchStudents(); fetchDocuments(); fetchExams(); fetchKbSubjects(); fetchBankQuestions(); }
  }, [token]);

  const [isCreatingStudent, setIsCreatingStudent] = useState(false);

  // ─── Handlers ──────────────────────────────────────────
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingStudent(true);
    try {
      const res = await apiFetch("/students/", {
        token, method: "POST",
        body: JSON.stringify({ email: studentEmail, full_name: studentName, roll_number: studentRoll })
      });
      if (res.ok) {
        showToast("Student profile created & authorization email queued.", "success");
        setStudentName(""); setStudentEmail(""); setStudentRoll("");
        fetchStudents();
      } else {
        const d = await res.json();
        showToast(d.detail || "Failed to create student", "error");
      }
    } catch { showToast("Network error", "error"); }
    finally { setIsCreatingStudent(false); }
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
          document_id: examDocumentId || undefined,
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
      let data: any = {};
      try {
        data = await res.json();
      } catch {}
      
      if (res.ok) {
        showToast("Assessment deleted successfully.", "success");
        setDeleteConfirmId(null);
        fetchExams();
        if (previewExam && previewExam.id === examId) {
          setPreviewExam(null);
        }
      } else {
        showToast(data.detail || `Failed to delete exam (${res.status})`, "error");
      }
    } catch (err: any) {
      showToast(`Delete request failed: ${err?.message || "Network error"}`, "error");
    }
  };

  // Sync edited questions when previewExam opens
  useEffect(() => {
    if (previewExam) {
      try {
        const qList = typeof previewExam.questions_json === "string" 
          ? JSON.parse(previewExam.questions_json) 
          : (previewExam.questions_json || []);
        setEditedQuestions(qList);
      } catch {
        setEditedQuestions([]);
      }
      setIsEditingPaper(false);
    } else {
      setEditedQuestions([]);
    }
  }, [previewExam]);

  // Live WebSocket Proctoring Stream
  useEffect(() => {
    if (!liveProctorExam) return;
    const wsUrl = getWebSocketUrl(`/attempts/ws/teacher/${liveProctorExam.id}`);
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLiveProctorAlerts((prev) => [data, ...prev.slice(0, 49)]);
        } catch {}
      };
    } catch {}

    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [liveProctorExam]);

  const handleSaveQuestions = async () => {
    if (!previewExam) return;
    setIsSavingPaper(true);
    try {
      const res = await apiFetch(`/exams/${previewExam.id}/questions`, {
        token,
        method: "PUT",
        body: JSON.stringify({ questions: editedQuestions })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Assessment questions saved successfully!", "success");
        setPreviewExam({ ...previewExam, questions_json: data.questions_json, total_marks: data.total_marks });
        fetchExams();
        setIsEditingPaper(false);
      } else {
        showToast(data.detail || "Failed to save questions", "error");
      }
    } catch {
      showToast("Network error saving questions", "error");
    } finally {
      setIsSavingPaper(false);
    }
  };

  const handleRerollQuestion = async (index: number) => {
    if (!previewExam) return;
    setRerollingIdx(index);
    try {
      const currentQ = editedQuestions[index];
      const res = await apiFetch(`/exams/${previewExam.id}/regenerate-question`, {
        token,
        method: "POST",
        body: JSON.stringify({
          question_index: index,
          topic: currentQ?.topic || previewExam.name,
          question_type: currentQ?.question_type || "mcq",
          difficulty: "medium"
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Question #${index + 1} regenerated with AI!`, "success");
        const updated = [...editedQuestions];
        updated[index] = data.question;
        setEditedQuestions(updated);
        setPreviewExam({ ...previewExam, questions_json: data.questions_json });
        fetchExams();
      } else {
        showToast(data.detail || "AI Re-roll failed", "error");
      }
    } catch {
      showToast("Network error re-rolling question", "error");
    } finally {
      setRerollingIdx(null);
    }
  };

  const handleAddCustomQuestion = () => {
    const newQ = {
      id: "custom_" + Date.now(),
      question_text: "New custom examination question stem...",
      question_type: "mcq",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correct_answer: "Option A",
      explanation: "Teacher provided solution rationale.",
      marks: 5,
      estimated_time_seconds: 60,
      topic: "General"
    };
    setEditedQuestions([...editedQuestions, newQ]);
    setIsEditingPaper(true);
    showToast("Added custom question card. Click 'Save Paper Changes' when done.", "info");
  };

  const handleDeleteSingleQuestion = (index: number) => {
    if (editedQuestions.length <= 1) {
      showToast("An exam paper must contain at least 1 question.", "error");
      return;
    }
    const updated = editedQuestions.filter((_, i) => i !== index);
    setEditedQuestions(updated);
    showToast(`Question #${index + 1} removed. Click 'Save Paper Changes' to apply.`, "info");
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
                            {/* Live Anti-Cheat Monitoring Room */}
                            {exam.is_published && (
                              <button
                                type="button"
                                onClick={() => { setLiveProctorExam(exam); setLiveProctorAlerts([]); }}
                                className="p-1.5 rounded border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all flex items-center gap-1 text-[10px] font-semibold"
                                title="Open Live Anti-Cheat Proctor Room"
                              >
                                <Radio className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 animate-pulse" />
                                <span className="hidden sm:inline">Proctor</span>
                              </button>
                            )}

                            {/* Preview Question Paper Modal Button */}
                            <button
                              type="button"
                              onClick={() => setPreviewExam(exam)}
                              className="p-1.5 rounded border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#C84B18] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] transition-all"
                              title="Interactive Question Studio & Preview"
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
                              href={`${API_V1}/exams/${exam.id}/pdf/question-paper`}
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
                  <label className={labelCls}>Knowledge Source (Subject)</label>
                  {kbSubjects.length > 0 ? (
                    <select
                      required
                      value={examSubject}
                      onChange={(e) => {
                        setExamSubject(e.target.value);
                        setExamDocumentId("");
                      }}
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
                      placeholder="e.g. general_101 or ai_unit_1"
                      className={inputCls}
                    />
                  )}
                  <p className="text-[11px] text-[#716D67]">Questions will be strictly generated using documents in this knowledge source.</p>
                </div>

                {/* Specific Document Selector (Optional) */}
                {examSubject && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <label className={labelCls}>Specific Document File (Optional)</label>
                    <select
                      value={examDocumentId}
                      onChange={(e) => setExamDocumentId(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">All Documents in {examSubject.replace(/_/g, " ").toUpperCase()}</option>
                      {documents
                        .filter((d) => !examSubject || (d.subject_id && d.subject_id.toLowerCase() === examSubject.toLowerCase()) || examSubject === "general_101")
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            📄 {d.title || d.filename}
                          </option>
                        ))}
                    </select>
                    <p className="text-[11px] text-[#716D67]">Scope generation strictly to one specific syllabus file or textbook note.</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className={labelCls}>Assessment Title</label>
                  <input type="text" required value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="e.g. Unit 1 Examination Paper" className={inputCls} />
                </div>

                <div className="space-y-1.5">
                  <label className={labelCls}>Topic Keyword</label>
                  <input type="text" value={examTopic} onChange={(e) => setExamTopic(e.target.value)} placeholder="e.g. Neural Networks, Machine Learning" className={inputCls} />
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

      {/* ═══════ TAB: QUESTION BANK STUDIO ═══════ */}
      {activeTab === "bank" && (
        <div className="space-y-6">
          <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-[#C84B18]" />
                  <span>Question Bank Studio</span>
                </h2>
                <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-0.5">
                  Browse, filter, and manage reusable questions across subjects and topics.
                </p>
              </div>

              <button
                onClick={() => setShowAddBankModal(true)}
                className="btn-primary flex items-center gap-2 text-xs py-2 px-4 shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>Add Question to Bank</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <input
                type="text"
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchBankQuestions()}
                placeholder="Search question text..."
                className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4]"
              />

              <select
                value={bankDifficulty}
                onChange={(e) => { setBankDifficulty(e.target.value); fetchBankQuestions(); }}
                className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4]"
              >
                <option value="">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>

              <button
                onClick={fetchBankQuestions}
                className="px-4 py-2 bg-[#E5E0D8] dark:bg-[#292524] hover:bg-[#D8D2C7] text-[#242321] dark:text-[#F5F5F4] rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingBank ? "animate-spin" : ""}`} />
                <span>Filter Question Bank</span>
              </button>
            </div>
          </div>

          {/* Question List Cards */}
          <div className="space-y-3">
            {bankQuestions.length === 0 ? (
              <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-8 text-center text-xs text-[#716D67] dark:text-[#A8A29E]">
                No questions found in bank. Add questions or save exam-generated questions.
              </div>
            ) : (
              bankQuestions.map((q, idx) => {
                let optionsList: string[] = [];
                try {
                  optionsList = q.options_json ? JSON.parse(q.options_json) : [];
                } catch {}

                return (
                  <div key={q.id} className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 space-y-3 shadow-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap text-[10px] font-semibold uppercase tracking-wider">
                          <span className="px-2 py-0.5 rounded bg-[#C84B18]/10 text-[#C84B18]">{q.subject_name || "General"}</span>
                          <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">{q.difficulty || "medium"}</span>
                          <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">{q.question_type}</span>
                          {q.topic && <span className="text-[#716D67] font-normal">Topic: {q.topic}</span>}
                        </div>
                        <h3 className="text-sm font-semibold text-[#242321] dark:text-[#F5F5F4] pt-1">
                          <MathText text={`${idx + 1}. ${q.question_text}`} />
                        </h3>
                      </div>
                    </div>

                    {/* Options list if MCQ */}
                    {optionsList.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {optionsList.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`px-3 py-1.5 rounded-lg text-xs border ${
                              opt === q.correct_answer || String.fromCharCode(65 + oIdx) === q.correct_answer
                                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold"
                                : "bg-[#F7F4EF] dark:bg-[#141312] border-[#E5E0D8] dark:border-[#292524] text-[#242321] dark:text-[#F5F5F4]"
                            }`}
                          >
                            <span className="font-bold mr-2">{String.fromCharCode(65 + oIdx)}.</span>
                            <MathText text={opt} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Add Bank Question Modal */}
          {showAddBankModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
              <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
                  <h3 className="text-sm font-bold text-[#242321] dark:text-[#F5F5F4]">Add Custom Question to Bank</h3>
                  <button onClick={() => setShowAddBankModal(false)} className="text-[#716D67] hover:text-[#242321]">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateBankQuestion} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold mb-1">Question Text</label>
                    <textarea
                      required
                      value={newBankText}
                      onChange={(e) => setNewBankText(e.target.value)}
                      placeholder="Enter question wording..."
                      className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-2 text-xs"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold mb-1">Type</label>
                      <select
                        value={newBankType}
                        onChange={(e) => setNewBankType(e.target.value)}
                        className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-2 text-xs"
                      >
                        <option value="MCQ">Multiple Choice</option>
                        <option value="True_False">True / False</option>
                        <option value="Subjective">Subjective / Written</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">Difficulty</label>
                      <select
                        value={newBankDiff}
                        onChange={(e) => setNewBankDiff(e.target.value)}
                        className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-2 text-xs"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>

                  {newBankType === "MCQ" && (
                    <div className="space-y-2">
                      <label className="block font-semibold">Options</label>
                      {newBankOptions.map((opt, oIdx) => (
                        <input
                          key={oIdx}
                          type="text"
                          placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                          value={opt}
                          onChange={(e) => {
                            const copy = [...newBankOptions];
                            copy[oIdx] = e.target.value;
                            setNewBankOptions(copy);
                          }}
                          className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-2 text-xs"
                        />
                      ))}
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold mb-1">Correct Answer</label>
                    <input
                      type="text"
                      required
                      value={newBankCorrect}
                      onChange={(e) => setNewBankCorrect(e.target.value)}
                      placeholder="e.g. Option text or A/B/C/D"
                      className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-2 text-xs"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddBankModal(false)}
                      className="px-4 py-2 border border-[#E5E0D8] dark:border-[#292524] rounded-lg text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      Save to Question Bank
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
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
                <button type="submit" disabled={isCreatingStudent} className="btn-primary w-full disabled:opacity-50">
                  {isCreatingStudent ? "Creating profile & sending email..." : "Create Student Record"}
                </button>
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
                    Candidate Evaluation Sheet — {studentAnswerModal.student_name}
                  </h3>
                  <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                    Exam: <b>{studentAnswerModal.exam_name}</b> | Roll: <b>{studentAnswerModal.roll_number || "N/A"}</b> | Score: <b className="text-[#C84B18]">{studentAnswerModal.score} / {studentAnswerModal.max_score} ({studentAnswerModal.percentage}%)</b>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`${API_V1}/reports/submission-detail/${studentAnswerModal.submission_id}/printable`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#C84B18]/10 text-[#C84B18] hover:bg-[#C84B18]/20 font-bold text-xs flex items-center gap-1.5 transition-all"
                  title="Open Official Student Response Booklet (PDF/Print)"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Print Response Sheet</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                <button
                  onClick={() => setStudentAnswerModal(null)}
                  className="p-1.5 rounded-lg text-[#716D67] hover:bg-[#E5E0D8]/50 dark:hover:bg-[#292524]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
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

                      <div className="pl-4 space-y-1.5 text-[11px]">
                        <div><b>Student Response:</b> <span className="font-mono text-[#242321] dark:text-[#F5F5F4]">{String(q.user_answer_text || q.user_answer || "No response provided.")}</span></div>
                        <div><b>Correct Answer:</b> <span className="font-mono text-emerald-700 dark:text-emerald-300 font-bold">{String(q.correct_answer_text || q.correct_answer)}</span></div>
                        {q.ai_feedback && (
                          <div className="text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md mt-1 border border-amber-200"><b>AI Evaluator Feedback:</b> {q.ai_feedback}</div>
                        )}
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

            <div className="pt-3 border-t border-[#E5E0D8] dark:border-[#292524] flex justify-between items-center shrink-0">
              <a
                href={`${API_V1}/reports/submission-detail/${studentAnswerModal.submission_id}/printable`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#C84B18] font-bold hover:underline flex items-center gap-1"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Open Full Printable Answer Booklet</span>
              </a>
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
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`${getFrontendBaseUrl()}/exam/${qrModalExam.exam_code}`)}`}
                alt={`QR Code for ${qrModalExam.name}`}
                className="w-48 h-48 mx-auto rounded-lg"
              />
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-[#FCEBE6] border border-[#F7D5CA] rounded-xl p-2.5 flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-[#9A3412] truncate">
                  {getFrontendBaseUrl()}/exam/{qrModalExam.exam_code}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${getFrontendBaseUrl()}/exam/${qrModalExam.exam_code}`);
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

      {/* ═══════ INTERACTIVE AI QUESTION STUDIO & EXAM PAPER EDITOR ═══════ */}
      {previewExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-4 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] border border-[#C84B18]/20 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    <span>AI Question Studio</span>
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
                  {isEditingPaper && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 animate-pulse">
                      Edit Mode Active
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

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingPaper(!isEditingPaper)}
                  className={`px-3 py-1.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isEditingPaper
                      ? "bg-blue-600 text-white border-blue-700 shadow-xs"
                      : "border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] hover:bg-[#E5E0D8]/40"
                  }`}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>{isEditingPaper ? "Viewing Paper" : "Edit Paper"}</span>
                </button>
                <button
                  onClick={() => setPreviewExam(null)}
                  className="p-1.5 rounded-md text-[#716D67] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Questions Scrollable Body */}
            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              <div className="flex items-center justify-between text-xs font-semibold text-[#716D67] dark:text-[#A8A29E]">
                <span>{editedQuestions.length} Examination Questions</span>
                <div className="flex items-center gap-3">
                  <span>Total: {editedQuestions.reduce((acc, q) => acc + (parseFloat(q.marks) || 0), 0)} Marks</span>
                  <button
                    type="button"
                    onClick={handleAddCustomQuestion}
                    className="text-[#C84B18] dark:text-[#EA580C] hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Custom Question</span>
                  </button>
                </div>
              </div>

              {editedQuestions.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#716D67] dark:text-[#A8A29E]">
                  No questions in this paper. Click "+ Add Custom Question" to create one.
                </div>
              ) : (
                editedQuestions.map((q: any, idx: number) => {
                  const isMcq = q.question_type === "mcq" || q.type === "mcq" || (q.options && q.options.length > 0);
                  const isRerolling = rerollingIdx === idx;

                  return (
                    <div
                      key={q.id || idx}
                      className="bg-[#F0ECE4]/40 dark:bg-[#1D1B19]/50 border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-4 space-y-3 relative group transition-all"
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

                        <div className="flex items-center gap-2">
                          {/* AI Single-Question Re-Roll Button */}
                          <button
                            type="button"
                            disabled={isRerolling}
                            onClick={() => handleRerollQuestion(idx)}
                            className="px-2.5 py-1 rounded bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-[11px] font-semibold text-[#716D67] hover:text-[#C84B18] hover:border-[#C84B18] transition-all flex items-center gap-1 disabled:opacity-50"
                            title="Regenerate only this question with AI"
                          >
                            <RefreshCw className={`h-3 w-3 ${isRerolling ? "animate-spin text-[#C84B18]" : ""}`} />
                            <span>{isRerolling ? "Re-rolling..." : "AI Re-Roll"}</span>
                          </button>

                          {/* Delete Question button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteSingleQuestion(idx)}
                            className="p-1 rounded text-[#716D67] hover:text-red-600 transition-colors"
                            title="Delete this question"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>

                          <div className="flex items-center gap-1 text-xs text-[#716D67] dark:text-[#A8A29E] font-semibold">
                            {isEditingPaper ? (
                              <input
                                type="number"
                                value={q.marks || 1}
                                onChange={(e) => {
                                  const updated = [...editedQuestions];
                                  updated[idx].marks = parseFloat(e.target.value) || 1;
                                  setEditedQuestions(updated);
                                }}
                                className="w-12 bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded px-1.5 py-0.5 text-xs text-right"
                              />
                            ) : (
                              <span>{q.marks || 1}</span>
                            )}
                            <span>Marks</span>
                          </div>
                        </div>
                      </div>

                      {/* Question Text with KaTeX Math support */}
                      {isEditingPaper ? (
                        <textarea
                          rows={2}
                          value={q.question_text || q.text || q.question}
                          onChange={(e) => {
                            const updated = [...editedQuestions];
                            updated[idx].question_text = e.target.value;
                            setEditedQuestions(updated);
                          }}
                          className="w-full bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-md p-2 text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:border-[#C84B18]"
                        />
                      ) : (
                        <p className="text-xs font-semibold text-[#242321] dark:text-[#F5F5F4] leading-relaxed">
                          <MathText text={q.question_text || q.text || q.question} />
                        </p>
                      )}

                      {/* MCQ Options with KaTeX Math */}
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
                                {isEditingPaper ? (
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => {
                                      const updated = [...editedQuestions];
                                      const newOpts = [...updated[idx].options];
                                      newOpts[optIdx] = e.target.value;
                                      updated[idx].options = newOpts;
                                      if (isCorrect) updated[idx].correct_answer = e.target.value;
                                      setEditedQuestions(updated);
                                    }}
                                    className="flex-1 bg-transparent border-b border-[#E5E0D8] dark:border-[#292524] px-1 py-0.5 text-xs focus:outline-none focus:border-[#C84B18]"
                                  />
                                ) : (
                                  <span className="truncate"><MathText text={opt} /></span>
                                )}
                                {isEditingPaper ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...editedQuestions];
                                      updated[idx].correct_answer = opt;
                                      setEditedQuestions(updated);
                                    }}
                                    className={`text-[10px] px-1.5 py-0.5 rounded ml-auto ${isCorrect ? "bg-emerald-600 text-white font-bold" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-600"}`}
                                  >
                                    {isCorrect ? "Correct" : "Set Correct"}
                                  </button>
                                ) : (
                                  isCorrect && <Check className="h-3.5 w-3.5 text-emerald-600 ml-auto shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Explanation / Solution */}
                      {q.explanation && (
                        <div className="p-2.5 rounded-md bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-[11px] text-[#716D67] dark:text-[#A8A29E] space-y-1">
                          <span className="font-semibold text-[#242321] dark:text-[#F5F5F4]">Solution / Rationale:</span>
                          {isEditingPaper ? (
                            <input
                              type="text"
                              value={q.explanation}
                              onChange={(e) => {
                                const updated = [...editedQuestions];
                                updated[idx].explanation = e.target.value;
                                setEditedQuestions(updated);
                              }}
                              className="w-full bg-transparent border-b border-[#E5E0D8] dark:border-[#292524] p-1 text-xs focus:outline-none focus:border-[#C84B18]"
                            />
                          ) : (
                            <p><MathText text={q.explanation} /></p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E5E0D8] dark:border-[#292524] shrink-0">
              <div className="flex items-center gap-2">
                <a
                  href={`${API_V1}/exams/${previewExam.id}/pdf/question-paper`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-md border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] text-xs font-medium flex items-center gap-1.5 hover:bg-[#E5E0D8]/40"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Paper PDF</span>
                </a>

                {isEditingPaper && (
                  <button
                    type="button"
                    disabled={isSavingPaper}
                    onClick={handleSaveQuestions}
                    className="px-3.5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{isSavingPaper ? "Saving Paper..." : "Save Paper Changes"}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewExam(null)}
                  className="px-4 py-2 rounded-md border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] text-xs font-medium"
                >
                  Close Studio
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

      {/* ═══════ LIVE ANTI-CHEAT PROCTORING COMMAND CENTER MODAL ═══════ */}
      {liveProctorExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            {/* Proctor Header */}
            <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-4 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                    <span>Live Anti-Cheat Stream</span>
                  </span>
                  <span className="text-xs text-[#716D67] font-mono">Exam Code: {liveProctorExam.exam_code}</span>
                </div>
                <h2 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">{liveProctorExam.name}</h2>
              </div>
              <button
                onClick={() => setLiveProctorExam(null)}
                className="p-1.5 rounded-md text-[#716D67] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Proctoring Stream Feed */}
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-lg p-3">
                  <div className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-300">Live Red Flags</div>
                  <div className="text-xl font-extrabold text-rose-700 dark:text-rose-300 mt-0.5 font-mono">{liveProctorAlerts.length}</div>
                </div>
                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                  <div className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">Proctoring Guard</div>
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mt-1">Active & Listening</div>
                </div>
                <div className="bg-[#F0ECE4]/60 dark:bg-[#1D1B19]/60 border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-3">
                  <div className="text-[10px] uppercase font-bold text-[#716D67]">Duration</div>
                  <div className="text-xs font-semibold text-[#242321] dark:text-[#F5F5F4] mt-1">{liveProctorExam.duration_minutes} Minutes</div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4] uppercase tracking-wider">Real-Time Event Stream</h3>
                {liveProctorAlerts.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#716D67] dark:text-[#A8A29E] bg-[#F0ECE4]/30 dark:bg-[#1D1B19]/30 rounded-lg border border-dashed border-[#E5E0D8] dark:border-[#292524]">
                    No violations detected. All candidates currently active and within exam focus.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {liveProctorAlerts.map((alert, i) => (
                      <div key={i} className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center justify-between text-xs animate-fadeIn">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                          <div>
                            <span className="font-bold text-rose-800 dark:text-rose-300 uppercase">{alert.event_type || "Violation"}: </span>
                            <span className="text-rose-700 dark:text-rose-400">{alert.details || "Tab focus lost"}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-rose-600 font-mono">{new Date().toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Proctor Footer */}
            <div className="pt-3 border-t border-[#E5E0D8] dark:border-[#292524] flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleEndExamEarly(liveProctorExam.id, liveProctorExam.name)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-semibold flex items-center gap-1"
              >
                <StopCircle className="h-3.5 w-3.5" />
                <span>End Assessment Early</span>
              </button>
              <button
                type="button"
                onClick={() => setLiveProctorExam(null)}
                className="px-4 py-1.5 border border-[#E5E0D8] dark:border-[#292524] rounded-md text-xs font-medium"
              >
                Close Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "../../../store/authStore";
import { useToast } from "../../../components/Toast";
import { apiFetch, API_V1, getWebSocketUrl } from "../../../lib/api";
import { 
  Plus, BookOpen, Calendar, ChevronRight, ChevronDown, Check,
  Users, BarChart3, GraduationCap, Clock, 
  Sparkles, ArrowRight, ArrowLeft, Radio, FileSpreadsheet,
  UploadCloud, FileUp, FileText, Loader2, CheckCircle2, X,
  Lightbulb, HelpCircle
} from "lucide-react";

import StudentDirectoryManager from "./_components/StudentDirectoryManager";
import CreateDirectoryModal from "./_components/CreateDirectoryModal";
import KnowledgeBaseManager from "./_components/KnowledgeBaseManager";
import QuestionBankManager from "./_components/QuestionBankManager";
import LiveAssessmentsTable from "./_components/LiveAssessmentsTable";
import PaperStudioModal from "./_components/PaperStudioModal";
import LiveProctoringModal from "./_components/LiveProctoringModal";
import GradebookAnalytics from "./_components/GradebookAnalytics";
import UploadKBModal from "./_components/UploadKBModal";
import { fetchStudentDirectories } from "@/lib/api/studentDirectories";
import { StudentDirectory } from "@/types/studentDirectory";

interface ReadyMadePrompt {
  id: string;
  title: string;
  icon: string;
  badge: string;
  description: string;
  prompt: string;
}

const READY_MADE_PROMPTS: ReadyMadePrompt[] = [
  {
    id: "code-debugging",
    title: "Code & Bug Hunt",
    icon: "💻",
    badge: "Coding / STEM",
    description: "Embed code snippets & edge cases",
    prompt: "Include concise Python or JavaScript code snippets in questions. Ask students to predict terminal output, trace variable states, or identify subtle syntax and logical errors.",
  },
  {
    id: "numerical-calc",
    title: "Numerical Calculations",
    icon: "🧮",
    badge: "Math & Physics",
    description: "Multi-step quantitative calculations",
    prompt: "Focus on multi-step numerical calculations. Provide explicit input variables and formulas, requiring students to calculate exact numerical solutions.",
  },
  {
    id: "case-scenario",
    title: "Workplace Case Studies",
    icon: "🏢",
    badge: "Applied / Business",
    description: "Real-world dilemmas & diagnosis",
    prompt: "Frame questions as realistic workplace scenarios. Require students to analyze the situation, evaluate architectural trade-offs, and recommend optimal decisions.",
  },
  {
    id: "critical-theory",
    title: "Deep Concepts (Anti-Guessing)",
    icon: "🧠",
    badge: "Conceptual",
    description: "Deep theory with plausible distractors",
    prompt: "Strictly avoid trivial definitions or rote memorization. Craft plausible distractors reflecting common student misconceptions to evaluate deep understanding.",
  },
  {
    id: "assertion-reason",
    title: "Assertion & Reason",
    icon: "⚖️",
    badge: "Analytical Reasoning",
    description: "Logical causality & truth values",
    prompt: "Formulate Assertion and Reason pairs. Test whether Assertion and Reason are true independently, and whether the Reason correctly explains the Assertion.",
  },
  {
    id: "foundational-clear",
    title: "Foundational & Clear",
    icon: "🎯",
    badge: "Introductory",
    description: "Accessible language with zero jargon",
    prompt: "Keep questions straightforward, direct, and unambiguous. Focus on fundamental principles with clear, educational explanations for each option.",
  },
];

export default function TeacherDashboard() {
  const { token, fullName } = useAuthStore();
  const { showToast } = useToast();
  
  const [mounted, setMounted] = useState(false);
  const [activeSectionTab, setActiveSectionTab] = useState<string>("all");

  const switchSectionTab = (tab: string) => {
    setActiveSectionTab(tab);
    if (typeof window !== "undefined") {
      window.location.hash = tab === "all" ? "" : tab;
    }
    fetchData();
  };

  useEffect(() => {
    setMounted(true);
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        setActiveSectionTab(hash);
      }
    };
    handleHash();
    const handleCustom = (e: any) => {
      if (e.detail) {
        setActiveSectionTab(e.detail);
        setTimeout(() => {
          document.getElementById(e.detail)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
      }
    };
    window.addEventListener("hashchange", handleHash);
    window.addEventListener("switch-tab", handleCustom);
    return () => {
      window.removeEventListener("hashchange", handleHash);
      window.removeEventListener("switch-tab", handleCustom);
    };
  }, []);
  
  // Data states
  const [createStep, setCreateStep] = useState<number>(1);
  const [expandedStep, setExpandedStep] = useState<number | null>(1);
  const [documents, setDocuments] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any | null>(null);
  const [kbSubjects, setKbSubjects] = useState<any[]>([]);
  
  // Step 1 Direct KB Upload state
  const [step1SourceMode, setStep1SourceMode] = useState<"select" | "upload">("select");
  const [step1UploadFile, setStep1UploadFile] = useState<File | null>(null);
  const [step1UploadSubject, setStep1UploadSubject] = useState("");
  const [isStep1Uploading, setIsStep1Uploading] = useState(false);
  const [step1UploadSuccess, setStep1UploadSuccess] = useState<{ fileName: string; subjectId: string } | null>(null);
  const [isStep1KbModalOpen, setIsStep1KbModalOpen] = useState(false);
  const [step1IsDragging, setStep1IsDragging] = useState(false);
  
  // Modal states
  const [previewExam, setPreviewExam] = useState<any | null>(null);
  const [liveProctorExam, setLiveProctorExam] = useState<any | null>(null);
  const [liveProctorAlerts, setLiveProctorAlerts] = useState<any[]>([]);

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
  const [cognitiveTarget, setCognitiveTarget] = useState("apply");
  const [diffEasyPct, setDiffEasyPct] = useState(30);
  const [diffMedPct, setDiffMedPct] = useState(50);
  const [diffHardPct, setDiffHardPct] = useState(20);
  const [customPromptInstructions, setCustomPromptInstructions] = useState("");
  const [showPromptGuide, setShowPromptGuide] = useState(false);
  const [examStartDate, setExamStartDate] = useState("");
  const [examEndDate, setExamEndDate] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [studentDirectories, setStudentDirectories] = useState<StudentDirectory[]>([]);
  const [selectedDirectoryId, setSelectedDirectoryId] = useState<string>("");
  const [isCreateDirModalOpen, setIsCreateDirModalOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState<string>("");

  // Load initial data
  const fetchData = async () => {
    if (!token) return;
    try {
      if (typeof window !== "undefined") {
        setWorkspaceName(localStorage.getItem("workspaceName") || "Teacher Workspace");
      }
      const [docsRes, examsRes, subjectsRes, dirsRes] = await Promise.all([
        apiFetch("/kb/documents", { token }).catch(() => null),
        apiFetch("/exams/", { token }).catch(() => null),
        apiFetch("/kb/subjects", { token }).catch(() => null),
        fetchStudentDirectories(token).catch(() => []),
      ]);

      if (docsRes && docsRes.ok) setDocuments(await docsRes.json().catch(() => []));
      if (examsRes && examsRes.ok) setExams(await examsRes.json().catch(() => []));
      if (subjectsRes && subjectsRes.ok) setKbSubjects(await subjectsRes.json().catch(() => []));
      if (Array.isArray(dirsRes)) {
        setStudentDirectories(dirsRes);
        if (dirsRes.length > 0 && !selectedDirectoryId) {
          setSelectedDirectoryId(dirsRes[0].id);
        }
      }
    } catch (e) {
      console.warn("fetchData notice:", e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    const handleSwitch = (e: any) => {
      const el = document.getElementById(e.detail);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("switch-tab", handleSwitch);
    return () => {
      window.removeEventListener("hashchange", handleHash);
      window.removeEventListener("switch-tab", handleSwitch);
    };
  }, []);

  // WebSocket Live Proctoring alerts feed
  useEffect(() => {
    if (!liveProctorExam || !token) return;

    let ws: WebSocket | null = null;
    try {
      const wsUrl = getWebSocketUrl(`/attempts/ws/teacher/${liveProctorExam.id}`);
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const alert = JSON.parse(event.data);
          setLiveProctorAlerts((prev) => [alert, ...prev]);
          showToast(`⚠️ Proctor Flag: ${alert.event_type || "Violation"} - ${alert.details || ""}`, "error");
        } catch {}
      };

      ws.onerror = () => {
        console.warn("Proctor WebSocket connection error");
      };
    } catch {}

    return () => {
      if (ws) ws.close();
    };
  }, [liveProctorExam, token]);

  // Exam Action Handlers
  const handlePublishExam = async (examId: string) => {
    try {
      const res = await apiFetch(`/exams/${examId}/publish`, { token, method: "POST" });
      if (res.ok) {
        showToast("Assessment published live to eligible candidates!", "success");
        fetchData();
      } else {
        showToast("Failed to publish assessment", "error");
      }
    } catch {
      showToast("Network error publishing exam", "error");
    }
  };

  const handleEndExamEarly = async (examId: string, examName: string) => {
    if (!confirm(`Are you sure you want to end assessment "${examName}" early? All active candidate sessions will close.`)) return;
    try {
      const res = await apiFetch(`/exams/${examId}/end-early`, { token, method: "POST" });
      if (res.ok) {
        showToast(`Assessment "${examName}" ended early. Grades computed.`, "success");
        fetchData();
        if (liveProctorExam && liveProctorExam.id === examId) setLiveProctorExam(null);
      } else {
        showToast("Failed to end exam early", "error");
      }
    } catch {
      showToast("Network error ending exam", "error");
    }
  };

  const handleDeleteExam = async (examId: string) => {
    try {
      const res = await apiFetch(`/exams/${examId}`, { token, method: "DELETE" });
      if (res.ok) {
        showToast("Assessment successfully deleted", "success");
        fetchData();
      } else {
        showToast("Failed to delete assessment", "error");
      }
    } catch {
      showToast("Network error deleting exam", "error");
    }
  };

  const handleGenerateCredentials = async (examId: string, examName: string) => {
    try {
      const res = await apiFetch(`/exams/${examId}/credentials`, { token, method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const count = Array.isArray(data) ? data.length : (data.count || 0);
        showToast(`Generated & emailed passcodes for ${count} candidates!`, "success");
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Failed to generate candidate passcodes", "error");
      }
    } catch {
      showToast("Network error generating passcodes", "error");
    }
  };

  const handleDownloadCredentialsCSV = async (examId: string, examName: string) => {
    try {
      const res = await apiFetch(`/exams/${examId}/credentials/export`, { token });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Candidate_Passcodes_${examName.replace(/\s+/g, "_")}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast("Candidate credentials CSV exported!", "success");
      }
    } catch {
      showToast("Failed to export credentials CSV", "error");
    }
  };

  // Create Exam Handler
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examName || !examSubject) {
      showToast("Please provide an assessment title and select a knowledge source", "error");
      return;
    }
    setIsGenerating(true);
    try {
      const totalMarksNum = parseFloat(examMarks) || 50;
      const numQuestions = questionType === "mixed" 
        ? (parseInt(numMcq) || 5) + (parseInt(numSubjective) || 2)
        : (parseInt(numMcq) || 5);
      const marksPerQ = Math.max(1, Math.round(totalMarksNum / (numQuestions || 1)));

      const blueprint = {
        topic: examTopic || "General",
        num_questions: numQuestions,
        difficulty: difficulty,
        question_type: questionType,
        marks_per_question: marksPerQ,
        cognitive_target: cognitiveTarget,
        custom_instructions: customPromptInstructions,
        distribution: {
          easy_pct: diffEasyPct,
          medium_pct: diffMedPct,
          hard_pct: diffHardPct,
        },
      };

      const payload = {
        name: examName,
        subject_id: examSubject,
        duration_minutes: parseInt(examDuration) || 30,
        total_marks: totalMarksNum,
        passing_marks: parseFloat(examPass) || 20,
        negative_marking: parseFloat(examNegative) || 0,
        start_time: examStartDate ? new Date(examStartDate).toISOString() : null,
        end_time: examEndDate ? new Date(examEndDate).toISOString() : null,
        student_directory_id: selectedDirectoryId || null,
        custom_instructions: customPromptInstructions,
        blueprint: blueprint,
        enable_ai_paper: true,
      };

      const res = await apiFetch("/exams/generate-from-kb", {
        token,
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const newExam = await res.json();
        showToast(`Assessment "${newExam.name}" successfully created!`, "success");
        setCreateStep(1);
        setExpandedStep(1);
        setExamName("");
        setActiveSectionTab("exams");
        if (typeof window !== "undefined") {
          window.location.hash = "exams";
        }
        fetchData();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.detail || "Assessment generation failed. Please try again.", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Network error while generating assessment", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const validateAndSetStep1File = (file: File) => {
    const maxSizeBytes = 25 * 1024 * 1024; // 25 MB
    if (file.size > maxSizeBytes) {
      showToast("File size exceeds 25MB limit. Please choose a smaller document.", "error");
      return;
    }
    setStep1UploadFile(file);

    // Auto-suggest subject name if empty
    if (!step1UploadSubject) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      setStep1UploadSubject(cleanName.slice(0, 30));
    }
  };

  const handleStep1DirectUpload = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!step1UploadFile) {
      showToast("Please select or drop a document to upload.", "error");
      return;
    }
    if (!step1UploadSubject.trim()) {
      showToast("Please specify a subject domain name for this document.", "error");
      return;
    }

    setIsStep1Uploading(true);
    try {
      const formData = new FormData();
      formData.append("file", step1UploadFile);
      formData.append("subject_id", step1UploadSubject.trim());

      const res = await apiFetch("/kb/upload", {
        token,
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const sub = step1UploadSubject.trim();
        const fName = step1UploadFile.name;
        showToast(`Document "${fName}" indexed into "${sub}"!`, "success");
        setStep1UploadSuccess({ fileName: fName, subjectId: sub });
        setExamSubject(sub);

        // Auto-fill exam title if empty
        if (!examName) {
          const cleanName = fName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
          setExamName(`${cleanName} Assessment`);
        }

        // Auto-fill topic if default
        if (!examTopic || examTopic === "General") {
          setExamTopic(sub);
        }

        setStep1UploadFile(null);
        setStep1UploadSubject("");
        setStep1SourceMode("select");

        // Refresh subjects and documents
        fetchData();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.detail || "Upload failed. Please check the document format.", "error");
      }
    } catch {
      showToast("Upload network error. Please verify backend connection.", "error");
    } finally {
      setIsStep1Uploading(false);
    }
  };

  const formatLocalDateTime = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const setSchedulePreset = (preset: string) => {
    const now = new Date();
    const durMins = parseInt(examDuration) || 30;
    if (preset === "now") {
      setExamStartDate(formatLocalDateTime(now));
      const end = new Date(now.getTime() + durMins * 60000);
      setExamEndDate(formatLocalDateTime(end));
    } else if (preset === "today4pm") {
      const start = new Date();
      start.setHours(16, 0, 0, 0);
      if (now > start) {
        start.setDate(start.getDate() + 1);
      }
      setExamStartDate(formatLocalDateTime(start));
      const end = new Date(start.getTime() + durMins * 60000);
      setExamEndDate(formatLocalDateTime(end));
    } else if (preset === "tomorrow10am") {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      start.setHours(10, 0, 0, 0);
      setExamStartDate(formatLocalDateTime(start));
      const end = new Date(start.getTime() + durMins * 60000);
      setExamEndDate(formatLocalDateTime(end));
    } else if (preset === "open30days") {
      setExamStartDate(formatLocalDateTime(now));
      const end = new Date(now.getTime() + 30 * 24 * 60 * 60000);
      setExamEndDate(formatLocalDateTime(end));
    }
  };

  const labelCls = "block text-xs font-semibold text-[#242321] dark:text-[#F5F5F4] mb-1 uppercase tracking-wider";
  const inputCls = "w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:ring-1 focus:ring-[#C84B18]";

  const WIZARD_STEPS = [
    {
      step: 1,
      title: "01. Knowledge Source & Details",
      shortTitle: "1. Source",
      summary: examName ? `${examName} • ${examSubject || "General"}` : (examSubject || "Domain & Title"),
      icon: BookOpen,
    },
    {
      step: 2,
      title: "02. Questions & AI Blueprint",
      shortTitle: "2. Questions",
      summary: `${numMcq} MCQ • ${difficulty.toUpperCase()}`,
      icon: Sparkles,
    },
    {
      step: 3,
      title: "03. Rules & Scheduling",
      shortTitle: "3. Schedule",
      summary: `${examDuration} min • ${examMarks} pts`,
      icon: Clock,
    },
    {
      step: 4,
      title: "04. Review & Synthesis",
      shortTitle: "4. Review",
      summary: "Directory & Generate",
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5E0D8] dark:border-[#292524] pb-6">
        <div>
          <span className="text-xs font-semibold text-[#C84B18] dark:text-[#EA580C] uppercase tracking-wider">
            Academic Instructor Workspace
          </span>
          <h1 className="text-2xl font-serif font-bold text-[#242321] dark:text-[#F5F5F4] mt-1">
            Teacher Command Center
          </h1>
          <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-0.5">
            Welcome, <b>{mounted && fullName ? fullName : "Instructor"}</b>. Autonomous AI assessment synthesis & proctoring sandbox.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              window.location.hash = "create";
              document.getElementById("create")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="btn-primary flex items-center gap-2 text-xs py-2 px-4 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Create Assessment</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[#C84B18]" />
            <span>Assessments</span>
          </div>
          <div className="text-2xl font-bold text-[#242321] dark:text-[#F5F5F4] mt-1">{exams.length}</div>
          <div className="text-[10px] text-[#716D67] mt-0.5">{exams.filter((e) => e.is_published).length} Published Live</div>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-[#C84B18]" />
            <span>Vector Docs</span>
          </div>
          <div className="text-2xl font-bold text-[#242321] dark:text-[#F5F5F4] mt-1">{documents.length}</div>
          <div className="text-[10px] text-[#716D67] mt-0.5">RAG Indexed Sources</div>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-[#C84B18]" />
            <span>Cohorts & Classes</span>
          </div>
          <div className="text-2xl font-bold text-[#242321] dark:text-[#F5F5F4] mt-1">{kbSubjects.length}</div>
          <div className="text-[10px] text-[#716D67] mt-0.5">Academic Mappings</div>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#C84B18]" />
            <span>AI Studio</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">Ready</div>
          <div className="text-[10px] text-[#716D67] mt-0.5">Gemini Co-Pilot Active</div>
        </div>
      </div>

      {/* View Switcher Pill Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#E5E0D8] dark:border-[#292524] scrollbar-none touch-pan-x">
        <button
          onClick={() => switchSectionTab("all")}
          className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
            activeSectionTab === "all"
              ? "bg-[#C84B18] text-white shadow-xs"
              : "bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] dark:hover:text-[#F5F5F4]"
          }`}
        >
          <span className="sm:hidden">All</span>
          <span className="hidden sm:inline">All Overview</span>
        </button>

        <button
          onClick={() => switchSectionTab("exams")}
          className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeSectionTab === "exams"
              ? "bg-[#C84B18] text-white shadow-xs"
              : "bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] dark:hover:text-[#F5F5F4]"
          }`}
        >
          <GraduationCap className="h-3.5 w-3.5" />
          <span className="sm:hidden">Exams ({exams.length})</span>
          <span className="hidden sm:inline">Assessments ({exams.length})</span>
        </button>

        <button
          onClick={() => switchSectionTab("create")}
          className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeSectionTab === "create"
              ? "bg-[#C84B18] text-white shadow-xs"
              : "bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] dark:hover:text-[#F5F5F4]"
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="sm:hidden">Create</span>
          <span className="hidden sm:inline">Create Quiz Wizard</span>
        </button>

        <button
          onClick={() => switchSectionTab("bank")}
          className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeSectionTab === "bank"
              ? "bg-[#C84B18] text-white shadow-xs"
              : "bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] dark:hover:text-[#F5F5F4]"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="sm:hidden">Bank</span>
          <span className="hidden sm:inline">Question Bank</span>
        </button>

        <button
          onClick={() => switchSectionTab("kb")}
          className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeSectionTab === "kb"
              ? "bg-[#C84B18] text-white shadow-xs"
              : "bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] dark:hover:text-[#F5F5F4]"
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span className="sm:hidden">KB ({documents.length})</span>
          <span className="hidden sm:inline">Knowledge Base ({documents.length})</span>
        </button>

        <button
          onClick={() => switchSectionTab("students")}
          className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeSectionTab === "students"
              ? "bg-[#C84B18] text-white shadow-xs"
              : "bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] dark:hover:text-[#F5F5F4]"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span className="sm:hidden">Students ({studentDirectories.length})</span>
          <span className="hidden sm:inline">Student Directory ({studentDirectories.length})</span>
        </button>

        <button
          onClick={() => switchSectionTab("reports")}
          className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeSectionTab === "reports"
              ? "bg-[#C84B18] text-white shadow-xs"
              : "bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] dark:hover:text-[#F5F5F4]"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span className="sm:hidden">Analytics</span>
          <span className="hidden sm:inline">Gradebook Analytics</span>
        </button>
      </div>

      {/* ═══════ SECTION 1: ASSESSMENTS TABLE ═══════ */}
      {(activeSectionTab === "all" || activeSectionTab === "exams") && (
      <section id="exams" className="scroll-mt-16 space-y-4">
        <LiveAssessmentsTable
          exams={exams}
          onOpenCreate={() => {
            const el = document.getElementById("create");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onPreviewExam={(exam) => setPreviewExam(exam)}
          onOpenLiveProctor={(exam) => {
            setLiveProctorExam(exam);
            setLiveProctorAlerts([]);
          }}
          onEndExamEarly={handleEndExamEarly}
          onPublishExam={handlePublishExam}
          onDeleteExam={handleDeleteExam}
          onGenerateCredentials={handleGenerateCredentials}
          onDownloadCredentialsCSV={handleDownloadCredentialsCSV}
        />
      </section>
      )}

      {/* ═══════ SECTION 2: CREATE ASSESSMENT WORKFLOW WIZARD ═══════ */}
      {(activeSectionTab === "all" || activeSectionTab === "create") && (
      <section id="create" className="scroll-mt-16 space-y-4">
        <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-4 sm:p-6 shadow-xs space-y-5 sm:space-y-6">
          {/* ═══════ HEADER & PROGRESS SUMMARY ═══════ */}
          <div className="space-y-4 pb-4 border-b border-[#E5E0D8] dark:border-[#292524]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#C84B18]/10 text-[#C84B18] dark:text-[#EA580C]">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <h2 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">
                    Create New Assessment
                  </h2>
                </div>
                <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-0.5">
                  Follow the 4 calibrated steps below or tap any tab to jump directly.
                </p>
              </div>

              {/* Step Progress Pill & Toggle Buttons */}
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C84B18]/10 text-[#C84B18] dark:text-[#EA580C] text-xs font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C84B18] dark:bg-[#EA580C] animate-pulse" />
                  <span>Step {createStep} of 4: {WIZARD_STEPS[createStep - 1].shortTitle}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedStep(expandedStep ? null : createStep)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-[#E5E0D8] dark:border-[#292524] hover:bg-[#F7F4EF] dark:hover:bg-[#1D1B19] text-[#716D67] dark:text-[#A8A29E] transition-colors cursor-pointer"
                >
                  {expandedStep ? "Hide / Minimize Step" : "Expand Step"}
                </button>
              </div>
            </div>

            {/* Visual Progress Line */}
            <div className="w-full bg-[#E5E0D8]/60 dark:bg-[#292524] h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-[#C84B18] to-emerald-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${(createStep / 4) * 100}%` }}
              />
            </div>

            {/* ═══════ INTERACTIVE STEPS TAB BAR NAVIGATION ═══════ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
              {WIZARD_STEPS.map((s) => {
                const isActive = createStep === s.step;
                const isExpanded = expandedStep === s.step;
                const isCompleted = createStep > s.step;
                const StepIcon = s.icon;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => {
                      setCreateStep(s.step);
                      setExpandedStep(s.step);
                    }}
                    className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 relative group ${
                      isActive && isExpanded
                        ? "bg-white dark:bg-[#1D1B19] border-[#C84B18] dark:border-[#EA580C] shadow-xs ring-1 ring-[#C84B18]/30"
                        : isActive
                        ? "bg-[#C84B18]/5 dark:bg-[#EA580C]/10 border-[#C84B18]/50"
                        : isCompleted
                        ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60 hover:border-emerald-400"
                        : "bg-[#F7F4EF]/50 dark:bg-[#141312]/50 border-[#E5E0D8] dark:border-[#292524] hover:bg-white dark:hover:bg-[#1D1B19] hover:border-[#C84B18]/40"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs transition-colors ${
                      isActive
                        ? "bg-[#C84B18] dark:bg-[#EA580C] text-white shadow-xs"
                        : isCompleted
                        ? "bg-emerald-600 text-white"
                        : "bg-[#E5E0D8] dark:bg-[#292524] text-[#716D67] group-hover:bg-[#C84B18]/10 group-hover:text-[#C84B18]"
                    }`}>
                      {isCompleted ? <Check className="h-4 w-4" /> : s.step}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold truncate ${
                          isActive
                            ? "text-[#C84B18] dark:text-[#EA580C]"
                            : isCompleted
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-[#242321] dark:text-[#F5F5F4]"
                        }`}>
                          {s.shortTitle}
                        </span>
                        {isActive && isExpanded && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#C84B18] dark:bg-[#EA580C] shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-[#716D67] dark:text-[#A8A29E] truncate">
                        {s.summary}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ═══════ TOP-DOWN COLLAPSIBLE STEPPER ═══════ */}
          <form onSubmit={handleCreateExam} className="space-y-4">
            
            {/* STEP 1: CONTENT SOURCE */}
            <div className={`border rounded-2xl transition-all overflow-hidden ${
              createStep === 1
                ? "bg-white dark:bg-[#171615] border-[#C84B18]/40 shadow-sm ring-1 ring-[#C84B18]/20"
                : createStep > 1
                ? "bg-white dark:bg-[#171615] border-[#E5E0D8] dark:border-[#292524]"
                : "bg-[#F7F4EF]/60 dark:bg-[#141312]/60 border-[#E5E0D8] dark:border-[#292524] opacity-85"
            }`}>
              {/* Step 1 Header Button */}
              <button
                type="button"
                onClick={() => {
                  if (expandedStep === 1) {
                    setExpandedStep(null);
                  } else {
                    setExpandedStep(1);
                    setCreateStep(1);
                  }
                }}
                className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-[#F7F4EF]/50 dark:hover:bg-[#1D1B19]/50 transition-colors focus:outline-none"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    createStep > 1
                      ? "bg-emerald-600 text-white"
                      : createStep === 1
                      ? "bg-[#C84B18] text-white"
                      : "bg-[#E5E0D8] dark:bg-[#292524] text-[#716D67]"
                  }`}>
                    {createStep > 1 ? <Check className="h-4 w-4" /> : "1"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-[#242321] dark:text-[#F5F5F4] break-words leading-snug">
                      01. Knowledge Source & Assessment Details
                    </h3>
                    <p className="text-xs text-[#716D67] dark:text-[#A8A29E] break-words line-clamp-2 mt-0.5">
                      {examName ? `${examName} • ${examSubject || "General"}` : "Select curriculum domain and title"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] hidden sm:inline">
                    {expandedStep === 1 ? "Minimize" : "Expand"}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-[#716D67] transition-transform duration-200 ${expandedStep === 1 ? "rotate-180" : ""}`} />
                </div>
              </button>

              {/* Step 1 Body */}
              {expandedStep === 1 && (
                <div className="p-4 sm:p-5 pt-1 border-t border-[#E5E0D8] dark:border-[#292524] space-y-4 max-w-3xl animate-fadeIn">
                  
                  {/* Knowledge Source Selection / Upload Dual-Mode Toggle */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <label className={labelCls}>Knowledge Source</label>
                      <button
                        type="button"
                        onClick={() => setIsStep1KbModalOpen(true)}
                        className="text-xs font-bold text-[#C84B18] dark:text-[#EA580C] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>+ Upload New KB</span>
                      </button>
                    </div>

                    {/* Mode Toggle Switcher */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 p-1 bg-[#F0ECE4]/60 dark:bg-[#1D1B19] rounded-xl border border-[#E5E0D8] dark:border-[#292524] gap-1.5">
                      <button
                        type="button"
                        onClick={() => setStep1SourceMode("select")}
                        className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          step1SourceMode === "select"
                            ? "bg-white dark:bg-[#292524] text-[#242321] dark:text-[#F5F5F4] shadow-xs"
                            : "text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-white"
                        }`}
                      >
                        <BookOpen className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Existing Knowledge Base</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep1SourceMode("upload")}
                        className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          step1SourceMode === "upload"
                            ? "bg-[#C84B18] dark:bg-[#EA580C] text-white shadow-xs"
                            : "text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-white"
                        }`}
                      >
                        <UploadCloud className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Upload New Document Now</span>
                      </button>
                    </div>

                    {/* Notification Chip if document was just uploaded */}
                    {step1UploadSuccess && (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>
                            Indexed <b>&ldquo;{step1UploadSuccess.fileName}&rdquo;</b> &rarr; Selected <b>&ldquo;{step1UploadSuccess.subjectId}&rdquo;</b>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setStep1UploadSuccess(null)}
                          className="text-emerald-600 hover:text-emerald-800 p-0.5"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* MODE A: Select from Existing Knowledge Base */}
                    {step1SourceMode === "select" ? (
                      <div className="space-y-1.5">
                        {kbSubjects.length > 0 ? (
                          <select
                            required
                            value={examSubject}
                            onChange={(e) => {
                              setExamSubject(e.target.value);
                              if (step1UploadSuccess && e.target.value !== step1UploadSuccess.subjectId) {
                                setStep1UploadSuccess(null);
                              }
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
                          <div className="space-y-2">
                            <input
                              type="text"
                              required
                              value={examSubject}
                              onChange={(e) => setExamSubject(e.target.value)}
                              placeholder="e.g. general_101 or ai_unit_1"
                              className={inputCls}
                            />
                            <p className="text-[11px] text-amber-600 dark:text-amber-400">
                              No existing KB documents found. Switch to &ldquo;Upload New Document Now&rdquo; above to add your lecture notes or textbooks!
                            </p>
                          </div>
                        )}
                        <p className="text-[11px] text-[#716D67]">
                          Questions will be strictly generated using documents in this knowledge source.
                        </p>
                      </div>
                    ) : (
                      /* MODE B: Direct Inline KB Document Upload */
                      <div className="space-y-3 p-3.5 rounded-xl bg-[#FBF9F5] dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524]">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-[#57534E] dark:text-[#A8A29E] uppercase tracking-wider">
                            Subject / Knowledge Domain <span className="text-[#C84B18]">*</span>
                          </label>
                          <input
                            type="text"
                            value={step1UploadSubject}
                            onChange={(e) => setStep1UploadSubject(e.target.value)}
                            placeholder="e.g. Machine_Learning_Unit_1"
                            list="existing-kb-subjects-list"
                            className={inputCls}
                          />
                          {kbSubjects.length > 0 && (
                            <datalist id="existing-kb-subjects-list">
                              {kbSubjects.map((s) => (
                                <option key={s.subject_id} value={s.subject_id} />
                              ))}
                            </datalist>
                          )}
                        </div>

                        {/* Dropzone */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setStep1IsDragging(true);
                          }}
                          onDragLeave={() => setStep1IsDragging(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setStep1IsDragging(false);
                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                              validateAndSetStep1File(e.dataTransfer.files[0]);
                            }
                          }}
                          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                            step1IsDragging
                              ? "border-[#C84B18] bg-[#C84B18]/5"
                              : step1UploadFile
                              ? "border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/10"
                              : "border-[#E5E0D8] dark:border-[#292524] hover:border-[#C84B18]/60 bg-white dark:bg-[#171615]"
                          }`}
                          onClick={() => {
                            const input = document.getElementById("step1-file-input");
                            if (input) input.click();
                          }}
                        >
                          <input
                            id="step1-file-input"
                            type="file"
                            accept=".pdf,.txt,.docx,.pptx,.md"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                validateAndSetStep1File(e.target.files[0]);
                              }
                            }}
                            className="hidden"
                          />

                          {step1UploadFile ? (
                            <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#171615] border border-emerald-500/30">
                              <div className="flex items-center gap-2.5 text-left truncate">
                                <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <div className="truncate">
                                  <div className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4] truncate">{step1UploadFile.name}</div>
                                  <div className="text-[10px] text-[#716D67]">{(step1UploadFile.size / 1024).toFixed(1)} KB</div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStep1UploadFile(null);
                                }}
                                className="p-1 text-rose-500 hover:text-rose-700 rounded cursor-pointer"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-1 py-1">
                              <UploadCloud className="h-6 w-6 text-[#C84B18] mx-auto" />
                              <div className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4]">
                                Drop document file or click to browse
                              </div>
                              <div className="text-[10px] text-[#716D67] dark:text-[#A8A29E]">
                                PDF, DOCX, TXT, PPTX (Max 25MB)
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Upload & Index Button */}
                        <button
                          type="button"
                          onClick={() => handleStep1DirectUpload()}
                          disabled={isStep1Uploading || !step1UploadFile || !step1UploadSubject.trim()}
                          className="w-full py-2 px-4 bg-[#C84B18] hover:bg-[#B33E0F] dark:bg-[#EA580C] text-white font-bold rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isStep1Uploading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Indexing into Vector DB...</span>
                            </>
                          ) : (
                            <>
                              <UploadCloud className="h-4 w-4" />
                              <span>Upload & Use as Knowledge Source</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelCls}>Assessment Title</label>
                    <input
                      type="text"
                      required
                      value={examName}
                      onChange={(e) => setExamName(e.target.value)}
                      placeholder="e.g. Unit 1 Examination Paper"
                      className={inputCls}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelCls}>Topic Keyword</label>
                    <input
                      type="text"
                      value={examTopic}
                      onChange={(e) => setExamTopic(e.target.value)}
                      placeholder="e.g. Neural Networks, Machine Learning"
                      className={inputCls}
                    />
                  </div>

                  <div className="pt-3 flex justify-end">
                    <button 
                      type="button" 
                      onClick={() => {
                        setCreateStep(2);
                        setExpandedStep(2);
                      }} 
                      className="w-full sm:w-auto btn-primary py-2.5 px-5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <span>Continue to Questions</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 2: QUESTIONS CONFIG */}
            <div className={`border rounded-2xl transition-all overflow-hidden ${
              createStep === 2
                ? "bg-white dark:bg-[#171615] border-[#C84B18]/40 shadow-sm ring-1 ring-[#C84B18]/20"
                : createStep > 2
                ? "bg-white dark:bg-[#171615] border-[#E5E0D8] dark:border-[#292524]"
                : "bg-[#F7F4EF]/60 dark:bg-[#141312]/60 border-[#E5E0D8] dark:border-[#292524] opacity-85"
            }`}>
              {/* Step 2 Header Button */}
              <button
                type="button"
                onClick={() => {
                  if (expandedStep === 2) {
                    setExpandedStep(null);
                  } else {
                    setExpandedStep(2);
                    setCreateStep(2);
                  }
                }}
                className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-[#F7F4EF]/50 dark:hover:bg-[#1D1B19]/50 transition-colors focus:outline-none"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    createStep > 2
                      ? "bg-emerald-600 text-white"
                      : createStep === 2
                      ? "bg-[#C84B18] text-white"
                      : "bg-[#E5E0D8] dark:bg-[#292524] text-[#716D67]"
                  }`}>
                    {createStep > 2 ? <Check className="h-4 w-4" /> : "2"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-[#242321] dark:text-[#F5F5F4] break-words leading-snug">
                      02. Question Format, Difficulty & AI Blueprint
                    </h3>
                    <p className="text-xs text-[#716D67] dark:text-[#A8A29E] break-words line-clamp-2 mt-0.5">
                      {numMcq} MCQ • {numSubjective} Subjective • Difficulty: {difficulty.toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] hidden sm:inline">
                    {expandedStep === 2 ? "Minimize" : "Expand"}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-[#716D67] transition-transform duration-200 ${expandedStep === 2 ? "rotate-180" : ""}`} />
                </div>
              </button>

              {/* Step 2 Body */}
              {expandedStep === 2 && (
                <div className="p-4 sm:p-5 pt-1 border-t border-[#E5E0D8] dark:border-[#292524] space-y-4 max-w-3xl animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className={labelCls}>Question Format</label>
                      <select
                        value={questionType}
                        onChange={(e: any) => setQuestionType(e.target.value)}
                        className={inputCls}
                      >
                        <option value="mcq">Multiple Choice (MCQ)</option>
                        <option value="subjective">Subjective / Descriptive</option>
                        <option value="tf">True / False</option>
                        <option value="mixed">Mixed (MCQ + Subjective)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelCls}>Difficulty Level</label>
                      <select
                        value={difficulty}
                        onChange={(e: any) => setDifficulty(e.target.value)}
                        className={inputCls}
                      >
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
                      <p className="text-[11px] text-[#716D67]">
                        Each question will have 4 domain-specific options with single correct answer.
                      </p>
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
                      <p className="text-[11px] text-[#716D67]">
                        Students will provide descriptive answers evaluated against rubric key concepts.
                      </p>
                    </div>
                  )}

                  {questionType === "mixed" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-1.5">
                        <label className={labelCls}>No. of MCQs</label>
                        <input
                          type="number"
                          value={numMcq}
                          onChange={(e) => setNumMcq(e.target.value)}
                          min="1"
                          max="40"
                          className={inputCls}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>No. of Subjective</label>
                        <input
                          type="number"
                          value={numSubjective || "2"}
                          onChange={(e) => setNumSubjective(e.target.value)}
                          min="1"
                          max="15"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  )}

                  {/* AI Cognitive Target & Custom Guidelines */}
                  <div className="p-4 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-3.5 pt-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#C84B18] dark:text-[#EA580C]" />
                      <span className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4]">
                        AI Blueprint Co-Pilot Tuning
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-[#57534E] dark:text-[#A8A29E] uppercase">
                          Bloom&apos;s Cognitive Target
                        </label>
                        <select
                          value={cognitiveTarget}
                          onChange={(e: any) => setCognitiveTarget(e.target.value)}
                          className={inputCls}
                        >
                          <option value="recall">Recall & Definitions (Knowledge)</option>
                          <option value="understand">Conceptual Understanding</option>
                          <option value="apply">Application & Problem Solving</option>
                          <option value="analyze">Critical Analysis & Reasoning</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-[#57534E] dark:text-[#A8A29E] uppercase">
                          Difficulty Ratio Blend
                        </label>
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <span className="text-[11px] font-semibold text-[#C84B18] bg-[#C84B18]/10 px-2 py-0.5 rounded">Easy: {diffEasyPct}%</span>
                          <span className="text-[11px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded">Med: {diffMedPct}%</span>
                          <span className="text-[11px] font-semibold text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded">Hard: {diffHardPct}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="text-[11px] font-bold text-[#57534E] dark:text-[#A8A29E] uppercase flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#C84B18]" />
                          <span>Teacher Instructions to AI Generator</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowPromptGuide((prev) => !prev)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#C84B18] dark:text-[#EA580C] hover:underline cursor-pointer"
                          >
                            <Lightbulb className="w-3 h-3" />
                            <span>{showPromptGuide ? "Hide Guide" : "Formulation Guide"}</span>
                          </button>
                          {customPromptInstructions && (
                            <button
                              type="button"
                              onClick={() => {
                                setCustomPromptInstructions("");
                                showToast("Custom instructions cleared", "info");
                              }}
                              className="text-[11px] text-[#716D67] hover:text-red-500 transition-colors cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Formulation Guide Collapsible */}
                      {showPromptGuide && (
                        <div className="p-3 bg-[#FAF8F5] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs space-y-2 animate-fadeIn">
                          <div className="flex items-center gap-1.5 font-bold text-[#242321] dark:text-[#F5F5F4] text-[11px]">
                            <HelpCircle className="w-3.5 h-3.5 text-[#C84B18]" />
                            <span>How to Formulate an Effective Prompt for AI Question Generation</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#716D67] dark:text-[#A8A29E]">
                            <div className="p-2 rounded-lg bg-white dark:bg-[#1C1A17] border border-[#E5E0D8] dark:border-[#292524]">
                              <p className="font-semibold text-[#242321] dark:text-[#F5F5F4] mb-0.5">1. Target Concepts</p>
                              <p>Pinpoint subtopics: &quot;Focus on concurrency, deadlocks, and thread safety rather than general OS definitions.&quot;</p>
                            </div>
                            <div className="p-2 rounded-lg bg-white dark:bg-[#1C1A17] border border-[#E5E0D8] dark:border-[#292524]">
                              <p className="font-semibold text-[#242321] dark:text-[#F5F5F4] mb-0.5">2. Practical Format</p>
                              <p>Request specific forms: &quot;Include a 4-line Python code block with tricky indexing and ask for stdout.&quot;</p>
                            </div>
                            <div className="p-2 rounded-lg bg-white dark:bg-[#1C1A17] border border-[#E5E0D8] dark:border-[#292524]">
                              <p className="font-semibold text-[#242321] dark:text-[#F5F5F4] mb-0.5">3. Negative Constraints</p>
                              <p>Eliminate weak questions: &quot;No trivia, no questions on history or year numbers, no &apos;All of the above&apos;.&quot;</p>
                            </div>
                            <div className="p-2 rounded-lg bg-white dark:bg-[#1C1A17] border border-[#E5E0D8] dark:border-[#292524]">
                              <p className="font-semibold text-[#242321] dark:text-[#F5F5F4] mb-0.5">4. Plausible Distractors</p>
                              <p>Prevent guessing: &quot;Ensure all 4 options look mathematically valid and target common conceptual misconceptions.&quot;</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <textarea
                        rows={3}
                        value={customPromptInstructions}
                        onChange={(e) => setCustomPromptInstructions(e.target.value)}
                        placeholder="e.g. Include Python code snippets, focus on numerical calculations, avoid trivial definitions... or click any ready-made sample below!"
                        className="w-full bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-2.5 text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:ring-1 focus:ring-[#C84B18] shadow-xs"
                      />

                      {/* Ready-made sample prompt pills */}
                      <div className="space-y-1.5 pt-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#716D67] dark:text-[#A8A29E] flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-[#C84B18]" />
                            <span>Ready-Made Sample Prompts (Click to Insert)</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {READY_MADE_PROMPTS.map((item) => {
                            const isSelected = customPromptInstructions.includes(item.prompt);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setCustomPromptInstructions((prev) =>
                                      prev.replace(item.prompt, "").replace(/\n\n+/g, "\n").trim()
                                    );
                                    showToast(`Removed "${item.title}" prompt`, "info");
                                  } else {
                                    setCustomPromptInstructions((prev) =>
                                      prev ? `${prev.trim()}\n\n${item.prompt}` : item.prompt
                                    );
                                    showToast(`Inserted "${item.title}" prompt!`, "success");
                                  }
                                }}
                                className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-1 group ${
                                  isSelected
                                    ? "bg-[#C84B18]/10 dark:bg-[#EA580C]/15 border-[#C84B18] dark:border-[#EA580C] shadow-xs"
                                    : "bg-[#FAF8F5] dark:bg-[#1C1A17] hover:bg-[#F0ECE4] dark:hover:bg-[#292524] border-[#E5E0D8] dark:border-[#292524] hover:border-[#C84B18]/40"
                                }`}
                                title={item.prompt}
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="flex items-center gap-1.5 text-xs font-bold text-[#242321] dark:text-[#F5F5F4]">
                                    <span>{item.icon}</span>
                                    <span className="group-hover:text-[#C84B18] transition-colors">{item.title}</span>
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#E5E0D8]/60 dark:bg-[#292524] text-[#716D67] dark:text-[#A8A29E] font-medium shrink-0">
                                    {item.badge}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E] line-clamp-2 leading-relaxed">
                                  {item.description}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCreateStep(1);
                        setExpandedStep(1);
                      }}
                      className="w-full sm:w-auto px-4 py-2 border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs font-semibold text-[#716D67] hover:text-[#242321] flex items-center justify-center gap-1.5 cursor-pointer bg-white dark:bg-[#171615]"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back to Source</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setCreateStep(3);
                        setExpandedStep(3);
                      }} 
                      className="w-full sm:w-auto btn-primary py-2.5 px-5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <span>Continue to Rules</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 3: RULES & SCHEDULING */}
            <div className={`border rounded-2xl transition-all overflow-hidden ${
              createStep === 3
                ? "bg-white dark:bg-[#171615] border-[#C84B18]/40 shadow-sm ring-1 ring-[#C84B18]/20"
                : createStep > 3
                ? "bg-white dark:bg-[#171615] border-[#E5E0D8] dark:border-[#292524]"
                : "bg-[#F7F4EF]/60 dark:bg-[#141312]/60 border-[#E5E0D8] dark:border-[#292524] opacity-85"
            }`}>
              {/* Step 3 Header Button */}
              <button
                type="button"
                onClick={() => {
                  if (expandedStep === 3) {
                    setExpandedStep(null);
                  } else {
                    setExpandedStep(3);
                    setCreateStep(3);
                  }
                }}
                className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-[#F7F4EF]/50 dark:hover:bg-[#1D1B19]/50 transition-colors focus:outline-none"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    createStep > 3
                      ? "bg-emerald-600 text-white"
                      : createStep === 3
                      ? "bg-[#C84B18] text-white"
                      : "bg-[#E5E0D8] dark:bg-[#292524] text-[#716D67]"
                  }`}>
                    {createStep > 3 ? <Check className="h-4 w-4" /> : "3"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-[#242321] dark:text-[#F5F5F4] break-words leading-snug">
                      03. Duration, Marks & Schedule Window
                    </h3>
                    <p className="text-xs text-[#716D67] dark:text-[#A8A29E] break-words line-clamp-2 mt-0.5">
                      {examDuration} Minutes • {examMarks} Total Marks
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] hidden sm:inline">
                    {expandedStep === 3 ? "Minimize" : "Expand"}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-[#716D67] transition-transform duration-200 ${expandedStep === 3 ? "rotate-180" : ""}`} />
                </div>
              </button>

              {/* Step 3 Body */}
              {expandedStep === 3 && (
                <div className="p-4 sm:p-5 pt-1 border-t border-[#E5E0D8] dark:border-[#292524] space-y-4 max-w-3xl animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className={labelCls}>Duration (Minutes)</label>
                      <input
                        type="number"
                        value={examDuration}
                        onChange={(e) => setExamDuration(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelCls}>Total Marks</label>
                      <input
                        type="number"
                        value={examMarks}
                        onChange={(e) => setExamMarks(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  {/* Presets Grid */}
                  <div className="space-y-2 pt-1">
                    <label className={labelCls}>Quick Schedule Presets</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setSchedulePreset("now")}
                        className="p-2 text-center text-xs font-semibold border border-[#E5E0D8] dark:border-[#292524] rounded-xl bg-[#F7F4EF] dark:bg-[#141312] hover:border-[#C84B18] transition-colors cursor-pointer truncate"
                      >
                        ⚡ Start Now
                      </button>
                      <button
                        type="button"
                        onClick={() => setSchedulePreset("open30days")}
                        className="p-2 text-center text-xs font-semibold border border-[#E5E0D8] dark:border-[#292524] rounded-xl bg-[#F7F4EF] dark:bg-[#141312] hover:border-[#C84B18] transition-colors cursor-pointer truncate"
                      >
                        📅 30-Day Window
                      </button>
                      <button
                        type="button"
                        onClick={() => setSchedulePreset("today4pm")}
                        className="p-2 text-center text-xs font-semibold border border-[#E5E0D8] dark:border-[#292524] rounded-xl bg-[#F7F4EF] dark:bg-[#141312] hover:border-[#C84B18] transition-colors cursor-pointer truncate"
                      >
                        Today 4 PM
                      </button>
                      <button
                        type="button"
                        onClick={() => setSchedulePreset("tomorrow10am")}
                        className="p-2 text-center text-xs font-semibold border border-[#E5E0D8] dark:border-[#292524] rounded-xl bg-[#F7F4EF] dark:bg-[#141312] hover:border-[#C84B18] transition-colors cursor-pointer truncate"
                      >
                        Tomorrow 10 AM
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className={labelCls}>Start Date & Time</label>
                      <input
                        type="datetime-local"
                        value={examStartDate}
                        onChange={(e) => setExamStartDate(e.target.value)}
                        className={`${inputCls} min-w-0`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelCls}>End Date & Time</label>
                      <input
                        type="datetime-local"
                        value={examEndDate}
                        onChange={(e) => setExamEndDate(e.target.value)}
                        className={`${inputCls} min-w-0`}
                      />
                    </div>
                  </div>

                  <div className="pt-3 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCreateStep(2);
                        setExpandedStep(2);
                      }}
                      className="w-full sm:w-auto px-4 py-2 border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs font-semibold text-[#716D67] hover:text-[#242321] flex items-center justify-center gap-1.5 cursor-pointer bg-white dark:bg-[#171615]"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back to Questions</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setCreateStep(4);
                        setExpandedStep(4);
                      }} 
                      className="w-full sm:w-auto btn-primary py-2.5 px-5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <span>Review & Generate</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 4: REVIEW & GENERATE */}
            <div className={`border rounded-2xl transition-all overflow-hidden ${
              createStep === 4
                ? "bg-white dark:bg-[#171615] border-[#C84B18]/40 shadow-sm ring-1 ring-[#C84B18]/20"
                : "bg-[#F7F4EF]/60 dark:bg-[#141312]/60 border-[#E5E0D8] dark:border-[#292524] opacity-85"
            }`}>
              {/* Step 4 Header Button */}
              <button
                type="button"
                onClick={() => {
                  if (expandedStep === 4) {
                    setExpandedStep(null);
                  } else {
                    setExpandedStep(4);
                    setCreateStep(4);
                  }
                }}
                className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-[#F7F4EF]/50 dark:hover:bg-[#1D1B19]/50 transition-colors focus:outline-none"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    createStep === 4
                      ? "bg-[#C84B18] text-white"
                      : "bg-[#E5E0D8] dark:bg-[#292524] text-[#716D67]"
                  }`}>
                    4
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-[#242321] dark:text-[#F5F5F4] break-words leading-snug">
                      04. Final Blueprint Review & AI Paper Synthesis
                    </h3>
                    <p className="text-xs text-[#716D67] dark:text-[#A8A29E] break-words line-clamp-2 mt-0.5">
                      Confirm blueprint specs and generate assessment
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] hidden sm:inline">
                    {expandedStep === 4 ? "Minimize" : "Expand"}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-[#716D67] transition-transform duration-200 ${expandedStep === 4 ? "rotate-180" : ""}`} />
                </div>
              </button>

              {/* Step 4 Body */}
              {expandedStep === 4 && (
                <div className="p-4 sm:p-5 pt-1 border-t border-[#E5E0D8] dark:border-[#292524] space-y-5 max-w-3xl animate-fadeIn">
                  {/* Student Directory Selector with + Create Directory button */}
                  <div className="pt-2 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4] uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-[#C84B18]" />
                        <span>Target Student Directory</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCreateDirModalOpen(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#C84B18] hover:text-[#A0360D] dark:text-[#EA580C] dark:hover:text-[#F97316] transition-colors cursor-pointer self-start sm:self-auto"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Create New Student Directory</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {studentDirectories.length > 0 ? (
                        <select
                          value={selectedDirectoryId}
                          onChange={(e) => setSelectedDirectoryId(e.target.value)}
                          className={inputCls}
                        >
                          <option value="">No Directory (Open Access)</option>
                          {studentDirectories.map((dir) => (
                            <option key={dir.id} value={dir.id}>
                              {dir.name} ({dir.student_count} candidate{dir.student_count !== 1 ? 's' : ''})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="p-3.5 border border-dashed border-[#E5E0D8] dark:border-[#292524] rounded-xl bg-[#F7F4EF]/50 dark:bg-[#141312]/50 text-center">
                          <p className="text-xs text-[#716D67] mb-2">No student directory created yet.</p>
                          <button
                            type="button"
                            onClick={() => setIsCreateDirModalOpen(true)}
                            className="btn-primary py-1.5 px-3 text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Create First Student Directory</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-[#716D67]">
                      Eligible students in this directory will be snapped as immutable assessment candidates.
                    </p>
                  </div>

                  <div className="bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 space-y-2.5 text-xs">
                    <h4 className="font-bold text-[#242321] dark:text-[#F5F5F4] text-xs uppercase tracking-wider">
                      Assessment Synthesis Summary
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#716D67] dark:text-[#A8A29E]">
                      <div className="break-words">Title: <b className="text-[#242321] dark:text-[#F5F5F4]">{examName || "Untitled Assessment"}</b></div>
                      <div className="break-words">Source: <b className="text-[#242321] dark:text-[#F5F5F4]">{examSubject || "General"}</b></div>
                      <div>Questions: <b className="text-[#242321] dark:text-[#F5F5F4]">{parseInt(numMcq) + parseInt(numSubjective)} Total ({numMcq} MCQ)</b></div>
                      <div>Duration: <b className="text-[#242321] dark:text-[#F5F5F4]">{examDuration} min</b></div>
                      <div>Marks: <b className="text-[#242321] dark:text-[#F5F5F4]">{examMarks} pts</b></div>
                      <div className="break-words">Directory: <b className="text-[#242321] dark:text-[#F5F5F4]">{studentDirectories.find(d => d.id === selectedDirectoryId)?.name || "Open / Unassigned"}</b></div>
                    </div>
                  </div>

                  <div className="pt-3 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCreateStep(3);
                        setExpandedStep(3);
                      }}
                      className="w-full sm:w-auto px-4 py-2 border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs font-semibold text-[#716D67] hover:text-[#242321] flex items-center justify-center gap-1.5 cursor-pointer bg-white dark:bg-[#171615]"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back to Schedule</span>
                    </button>
                    <button 
                      type="submit" 
                      disabled={isGenerating} 
                      className="w-full sm:w-auto btn-primary py-2.5 px-6 text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
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
            </div>

          </form>
        </div>
      </section>
      )}

      {/* ═══════ SECTION 3: QUESTION BANK STUDIO ═══════ */}
      {(activeSectionTab === "all" || activeSectionTab === "bank") && (
      <section id="bank" className="scroll-mt-16 space-y-4">
        <QuestionBankManager />
      </section>
      )}

      {/* ═══════ SECTION 4: KNOWLEDGE SOURCES (RAG VECTOR DB) ═══════ */}
      {(activeSectionTab === "all" || activeSectionTab === "kb") && (
      <section id="kb" className="scroll-mt-16 space-y-4">
        <KnowledgeBaseManager
          documents={documents}
          token={token}
          onRefresh={fetchData}
        />
      </section>
      )}

      {/* ═══════ SECTION 5: STUDENT DIRECTORY MANAGER ═══════ */}
      {(activeSectionTab === "all" || activeSectionTab === "students") && (
      <section id="students" className="scroll-mt-16 space-y-4">
        <StudentDirectoryManager token={token} />
      </section>
      )}

      {/* Inline Create Directory Modal */}
      <CreateDirectoryModal
        isOpen={isCreateDirModalOpen}
        onClose={() => setIsCreateDirModalOpen(false)}
        onCreated={(newDir) => {
          setStudentDirectories((prev) => [newDir, ...prev]);
          setSelectedDirectoryId(newDir.id);
          showToast(`Student Directory "${newDir.name}" created and selected!`, "success");
        }}
      />

      {/* Step 1 Quick Upload KB Modal */}
      <UploadKBModal
        isOpen={isStep1KbModalOpen}
        onClose={() => setIsStep1KbModalOpen(false)}
        token={token}
        availableSubjects={kbSubjects}
        onUploaded={(subId, fName) => {
          setStep1UploadSuccess({ fileName: fName, subjectId: subId });
          setExamSubject(subId);
          if (!examName) {
            const cleanName = fName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
            setExamName(`${cleanName} Assessment`);
          }
          if (!examTopic || examTopic === "General") {
            setExamTopic(subId);
          }
          setStep1SourceMode("select");
          fetchData();
        }}
      />

      {/* ═══════ SECTION 6: GENERALIZED CLASSROOM QUIZ ANALYTICS ═══════ */}
      {(activeSectionTab === "all" || activeSectionTab === "reports") && (
      <section id="reports" className="scroll-mt-16 space-y-4">
        <GradebookAnalytics exams={exams} />
      </section>
      )}

      {/* ═══════ GLOBAL PAPER STUDIO PREVIEW MODAL ═══════ */}
      {previewExam && (
        <PaperStudioModal
          exam={previewExam}
          onClose={() => setPreviewExam(null)}
          onRefresh={fetchData}
          onPublishExam={handlePublishExam}
          onEndExamEarly={handleEndExamEarly}
          onDeleteExam={handleDeleteExam}
        />
      )}

      {/* ═══════ GLOBAL LIVE ANTI-CHEAT PROCTORING COMMAND CENTER MODAL ═══════ */}
      {liveProctorExam && (
        <LiveProctoringModal
          exam={liveProctorExam}
          alerts={liveProctorAlerts}
          onClose={() => setLiveProctorExam(null)}
          onEndExamEarly={handleEndExamEarly}
        />
      )}
    </div>
  );
}

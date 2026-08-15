"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "../../../store/authStore";
import { useToast } from "../../../components/Toast";
import { apiFetch, API_V1, getWebSocketUrl } from "../../../lib/api";
import { 
  Plus, BookOpen, Calendar, ChevronRight, ChevronDown, Check,
  Users, BarChart3, GraduationCap, Clock, 
  Sparkles, ArrowRight, ArrowLeft, Radio, FileSpreadsheet
} from "lucide-react";

import StudentRepository from "./_components/StudentRepository";
import KnowledgeBaseManager from "./_components/KnowledgeBaseManager";
import QuestionBankManager from "./_components/QuestionBankManager";
import LiveAssessmentsTable from "./_components/LiveAssessmentsTable";
import PaperStudioModal from "./_components/PaperStudioModal";
import LiveProctoringModal from "./_components/LiveProctoringModal";
import GradebookAnalytics from "./_components/GradebookAnalytics";

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
  
  // Data states
  const [createStep, setCreateStep] = useState<number>(1);
  const [documents, setDocuments] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any | null>(null);
  const [kbSubjects, setKbSubjects] = useState<any[]>([]);
  
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
  const [examStartDate, setExamStartDate] = useState("");
  const [examEndDate, setExamEndDate] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Load initial data
  const fetchData = async () => {
    if (!token) return;
    try {
      const [docsRes, examsRes, subjectsRes] = await Promise.all([
        apiFetch("/kb/documents", { token }),
        apiFetch("/exams/", { token }),
        apiFetch("/kb/subjects", { token }),
      ]);

      if (docsRes.ok) setDocuments(await docsRes.json());
      if (examsRes.ok) setExams(await examsRes.json());
      if (subjectsRes.ok) setKbSubjects(await subjectsRes.json());
    } catch {
      showToast("Network error while loading dashboard data", "error");
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

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
        setExamName("");
        setActiveTab("exams");
        window.location.hash = "exams";
        fetchData();
      } else {
        showToast("Assessment generation failed. Please try again.", "error");
      }
    } catch {
      showToast("Network error while generating assessment", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const setSchedulePreset = (preset: string) => {
    const now = new Date();
    if (preset === "now") {
      setExamStartDate(now.toISOString().slice(0, 16));
      const end = new Date(now.getTime() + (parseInt(examDuration) || 30) * 60000);
      setExamEndDate(end.toISOString().slice(0, 16));
    } else if (preset === "today4pm") {
      const start = new Date();
      start.setHours(16, 0, 0, 0);
      setExamStartDate(start.toISOString().slice(0, 16));
      const end = new Date(start.getTime() + (parseInt(examDuration) || 30) * 60000);
      setExamEndDate(end.toISOString().slice(0, 16));
    } else if (preset === "tomorrow10am") {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      start.setHours(10, 0, 0, 0);
      setExamStartDate(start.toISOString().slice(0, 16));
      const end = new Date(start.getTime() + (parseInt(examDuration) || 30) * 60000);
      setExamEndDate(end.toISOString().slice(0, 16));
    }
  };

  const labelCls = "block text-xs font-semibold text-[#242321] dark:text-[#F5F5F4] mb-1 uppercase tracking-wider";
  const inputCls = "w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:ring-1 focus:ring-[#C84B18]";

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
            Welcome, <b>{fullName || "Instructor"}</b>. Autonomous AI assessment synthesis & proctoring sandbox.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setActiveTab("create");
              window.location.hash = "create";
            }}
            className="btn-primary flex items-center gap-2 text-xs py-2 px-4 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Create Assessment</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[#C84B18]" />
            <span>Assessments</span>
          </div>
          <div className="text-2xl font-bold text-[#242321] dark:text-[#F5F5F4] mt-1">{exams.length}</div>
          <div className="text-[10px] text-[#716D67] mt-0.5">{exams.filter((e) => e.is_published).length} Published Live</div>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-[#C84B18]" />
            <span>Vector Docs</span>
          </div>
          <div className="text-2xl font-bold text-[#242321] dark:text-[#F5F5F4] mt-1">{documents.length}</div>
          <div className="text-[10px] text-[#716D67] mt-0.5">RAG Indexed Sources</div>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-[#C84B18]" />
            <span>Cohorts & Classes</span>
          </div>
          <div className="text-2xl font-bold text-[#242321] dark:text-[#F5F5F4] mt-1">{kbSubjects.length}</div>
          <div className="text-[10px] text-[#716D67] mt-0.5">Academic Mappings</div>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#C84B18]" />
            <span>AI Studio</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">Ready</div>
          <div className="text-[10px] text-[#716D67] mt-0.5">Gemini Co-Pilot Active</div>
        </div>
      </div>

      {/* Tabs Switcher Navigation */}
      <div className="border-b border-[#E5E0D8] dark:border-[#292524] flex items-center space-x-6 text-xs font-semibold overflow-x-auto pb-0.5 scrollbar-none whitespace-nowrap">
        {[
          { id: "exams", label: "Assessments", icon: Calendar },
          { id: "create", label: "Create Assessment", icon: Plus },
          { id: "bank", label: "Question Bank", icon: BookOpen },
          { id: "kb", label: "Knowledge Sources", icon: FileSpreadsheet },
          { id: "students", label: "Student Directory", icon: Users },
          { id: "reports", label: "Classroom Analytics", icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isCurrent = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                window.location.hash = tab.id;
              }}
              className={`flex items-center gap-2 pb-3 border-b-2 transition-all cursor-pointer ${
                isCurrent
                  ? "border-[#C84B18] text-[#C84B18] dark:border-[#EA580C] dark:text-[#EA580C]"
                  : "border-transparent text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4]"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══════ TAB 1: ASSESSMENTS TABLE ═══════ */}
      {activeTab === "exams" && (
        <LiveAssessmentsTable
          exams={exams}
          onOpenCreate={() => {
            setActiveTab("create");
            window.location.hash = "create";
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
      )}

      {/* ═══════ TAB 2: MULTI-STEP ASSESSMENT CREATION WORKFLOW WIZARD ═══════ */}
      {activeTab === "create" && (
        <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E5E0D8] dark:border-[#292524]">
            <div>
              <h2 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">
                Assessment Synthesis & Configuration
              </h2>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                Follow the 4 top-down steps below to synthesize and calibrate your examination paper.
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C84B18]/10 text-[#C84B18] text-xs font-bold self-start sm:self-auto">
              <span>Step {createStep} of 4</span>
            </div>
          </div>

          {/* ═══════ TOP-DOWN VERTICAL STEPPER ═══════ */}
          <form onSubmit={handleCreateExam} className="space-y-4">
            
            {/* STEP 1: CONTENT SOURCE */}
            <div className={`border rounded-2xl transition-all overflow-hidden ${
              createStep === 1
                ? "bg-white dark:bg-[#171615] border-[#C84B18]/40 shadow-sm ring-1 ring-[#C84B18]/20"
                : createStep > 1
                ? "bg-white dark:bg-[#171615] border-[#E5E0D8] dark:border-[#292524]"
                : "bg-[#F7F4EF]/60 dark:bg-[#141312]/60 border-[#E5E0D8] dark:border-[#292524] opacity-85"
            }`}>
              {/* Step 1 Header */}
              <div
                onClick={() => setCreateStep(1)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#F7F4EF]/50 dark:hover:bg-[#1D1B19]/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${
                    createStep > 1
                      ? "bg-emerald-600 text-white"
                      : createStep === 1
                      ? "bg-[#C84B18] text-white"
                      : "bg-[#E5E0D8] dark:bg-[#292524] text-[#716D67]"
                  }`}>
                    {createStep > 1 ? <Check className="h-4 w-4" /> : "1"}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#242321] dark:text-[#F5F5F4]">
                      01. Knowledge Source & Assessment Details
                    </h3>
                    <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                      {examName ? `${examName} • ${examSubject || "General"}` : "Select curriculum domain and title"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {createStep > 1 && (
                    <span className="text-xs font-semibold text-[#C84B18] hover:underline">Edit</span>
                  )}
                  <ChevronDown className={`h-4 w-4 text-[#716D67] transition-transform ${createStep === 1 ? "rotate-180" : ""}`} />
                </div>
              </div>

              {/* Step 1 Body */}
              {createStep === 1 && (
                <div className="p-5 pt-1 border-t border-[#E5E0D8] dark:border-[#292524] space-y-4 max-w-xl animate-fadeIn">
                  <div className="space-y-1.5 pt-2">
                    <label className={labelCls}>Knowledge Source (Subject)</label>
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
                        placeholder="e.g. general_101 or ai_unit_1"
                        className={inputCls}
                      />
                    )}
                    <p className="text-[11px] text-[#716D67]">
                      Questions will be strictly generated using documents in this knowledge source.
                    </p>
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

                  <div className="pt-2 flex justify-end">
                    <button type="button" onClick={() => setCreateStep(2)} className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 shadow-xs">
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
              {/* Step 2 Header */}
              <div
                onClick={() => setCreateStep(2)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#F7F4EF]/50 dark:hover:bg-[#1D1B19]/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${
                    createStep > 2
                      ? "bg-emerald-600 text-white"
                      : createStep === 2
                      ? "bg-[#C84B18] text-white"
                      : "bg-[#E5E0D8] dark:bg-[#292524] text-[#716D67]"
                  }`}>
                    {createStep > 2 ? <Check className="h-4 w-4" /> : "2"}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#242321] dark:text-[#F5F5F4]">
                      02. Question Format, Difficulty & AI Blueprint
                    </h3>
                    <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                      {numMcq} MCQ • {numSubjective} Subjective • Difficulty: {difficulty.toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {createStep > 2 && (
                    <span className="text-xs font-semibold text-[#C84B18] hover:underline">Edit</span>
                  )}
                  <ChevronDown className={`h-4 w-4 text-[#716D67] transition-transform ${createStep === 2 ? "rotate-180" : ""}`} />
                </div>
              </div>

              {/* Step 2 Body */}
              {createStep === 2 && (
                <div className="p-5 pt-1 border-t border-[#E5E0D8] dark:border-[#292524] space-y-4 max-w-xl animate-fadeIn">
                  <div className="grid grid-cols-2 gap-4 pt-2">
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
                    <div className="grid grid-cols-2 gap-4">
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
                          Bloom's Cognitive Target
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
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[11px] font-semibold text-[#C84B18]">Easy: {diffEasyPct}%</span>
                          <span className="text-[11px] font-semibold text-amber-600">Med: {diffMedPct}%</span>
                          <span className="text-[11px] font-semibold text-rose-600">Hard: {diffHardPct}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#57534E] dark:text-[#A8A29E] uppercase">
                        Teacher Instructions to AI Generator
                      </label>
                      <textarea
                        rows={2}
                        value={customPromptInstructions}
                        onChange={(e) => setCustomPromptInstructions(e.target.value)}
                        placeholder="e.g. Include Python code snippets, focus on numerical calculations, avoid trivial definitions..."
                        className="w-full bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-2 text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:ring-1 focus:ring-[#C84B18]"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setCreateStep(1)}
                      className="px-3.5 py-2 border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs font-semibold text-[#716D67] hover:text-[#242321] flex items-center gap-1.5"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back</span>
                    </button>
                    <button type="button" onClick={() => setCreateStep(3)} className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 shadow-xs">
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
              {/* Step 3 Header */}
              <div
                onClick={() => setCreateStep(3)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#F7F4EF]/50 dark:hover:bg-[#1D1B19]/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${
                    createStep > 3
                      ? "bg-emerald-600 text-white"
                      : createStep === 3
                      ? "bg-[#C84B18] text-white"
                      : "bg-[#E5E0D8] dark:bg-[#292524] text-[#716D67]"
                  }`}>
                    {createStep > 3 ? <Check className="h-4 w-4" /> : "3"}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#242321] dark:text-[#F5F5F4]">
                      03. Duration, Marks & Schedule Window
                    </h3>
                    <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                      {examDuration} Minutes • {examMarks} Total Marks
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {createStep > 3 && (
                    <span className="text-xs font-semibold text-[#C84B18] hover:underline">Edit</span>
                  )}
                  <ChevronDown className={`h-4 w-4 text-[#716D67] transition-transform ${createStep === 3 ? "rotate-180" : ""}`} />
                </div>
              </div>

              {/* Step 3 Body */}
              {createStep === 3 && (
                <div className="p-5 pt-1 border-t border-[#E5E0D8] dark:border-[#292524] space-y-4 max-w-xl animate-fadeIn">
                  <div className="grid grid-cols-2 gap-4 pt-2">
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

                  {/* Presets */}
                  <div className="space-y-2 pt-1">
                    <label className={labelCls}>Quick Schedule Presets</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSchedulePreset("now")}
                        className="px-3 py-1.5 text-xs font-semibold border border-[#E5E0D8] dark:border-[#292524] rounded-lg bg-[#F7F4EF] dark:bg-[#141312] hover:border-[#C84B18]"
                      >
                        ⚡ Start Now
                      </button>
                      <button
                        type="button"
                        onClick={() => setSchedulePreset("today4pm")}
                        className="px-3 py-1.5 text-xs font-semibold border border-[#E5E0D8] dark:border-[#292524] rounded-lg bg-[#F7F4EF] dark:bg-[#141312] hover:border-[#C84B18]"
                      >
                        Today 4 PM
                      </button>
                      <button
                        type="button"
                        onClick={() => setSchedulePreset("tomorrow10am")}
                        className="px-3 py-1.5 text-xs font-semibold border border-[#E5E0D8] dark:border-[#292524] rounded-lg bg-[#F7F4EF] dark:bg-[#141312] hover:border-[#C84B18]"
                      >
                        Tomorrow 10 AM
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className={labelCls}>Start Date & Time</label>
                      <input
                        type="datetime-local"
                        value={examStartDate}
                        onChange={(e) => setExamStartDate(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelCls}>End Date & Time</label>
                      <input
                        type="datetime-local"
                        value={examEndDate}
                        onChange={(e) => setExamEndDate(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setCreateStep(2)}
                      className="px-3.5 py-2 border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs font-semibold text-[#716D67] hover:text-[#242321] flex items-center gap-1.5"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back</span>
                    </button>
                    <button type="button" onClick={() => setCreateStep(4)} className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 shadow-xs">
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
              {/* Step 4 Header */}
              <div
                onClick={() => setCreateStep(4)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#F7F4EF]/50 dark:hover:bg-[#1D1B19]/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${
                    createStep === 4
                      ? "bg-[#C84B18] text-white"
                      : "bg-[#E5E0D8] dark:bg-[#292524] text-[#716D67]"
                  }`}>
                    4
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#242321] dark:text-[#F5F5F4]">
                      04. Final Blueprint Review & AI Paper Synthesis
                    </h3>
                    <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                      Confirm blueprint specs and generate assessment
                    </p>
                  </div>
                </div>

                <ChevronDown className={`h-4 w-4 text-[#716D67] transition-transform ${createStep === 4 ? "rotate-180" : ""}`} />
              </div>

              {/* Step 4 Body */}
              {createStep === 4 && (
                <div className="p-5 pt-1 border-t border-[#E5E0D8] dark:border-[#292524] space-y-4 max-w-xl animate-fadeIn">
                  <div className="bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 space-y-2.5 text-xs mt-2">
                    <h4 className="font-bold text-[#242321] dark:text-[#F5F5F4] text-xs uppercase tracking-wider">
                      Assessment Synthesis Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-[#716D67] dark:text-[#A8A29E]">
                      <div>Title: <b className="text-[#242321] dark:text-[#F5F5F4]">{examName || "Untitled Assessment"}</b></div>
                      <div>Source: <b className="text-[#242321] dark:text-[#F5F5F4]">{examSubject || "General"}</b></div>
                      <div>Questions: <b className="text-[#242321] dark:text-[#F5F5F4]">{parseInt(numMcq) + parseInt(numSubjective)} Total ({numMcq} MCQ)</b></div>
                      <div>Duration: <b className="text-[#242321] dark:text-[#F5F5F4]">{examDuration} min</b></div>
                      <div>Marks: <b className="text-[#242321] dark:text-[#F5F5F4]">{examMarks} pts</b></div>
                      <div>Difficulty: <b className="text-[#242321] dark:text-[#F5F5F4] uppercase">{difficulty}</b></div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setCreateStep(3)}
                      className="px-3.5 py-2 border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs font-semibold text-[#716D67] hover:text-[#242321] flex items-center gap-1.5"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back</span>
                    </button>
                    <button type="submit" disabled={isGenerating} className="btn-primary py-2 px-5 text-xs font-bold flex items-center gap-2 shadow-xs">
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
      )}

      {/* ═══════ TAB 3: QUESTION BANK STUDIO ═══════ */}
      {activeTab === "bank" && <QuestionBankManager />}

      {/* ═══════ TAB 4: KNOWLEDGE SOURCES (RAG VECTOR DB) ═══════ */}
      {activeTab === "kb" && (
        <KnowledgeBaseManager
          documents={documents}
          token={token}
          onRefresh={fetchData}
        />
      )}

      {/* ═══════ TAB 5: STUDENT ROSTER & ACADEMIC REPOSITORY ═══════ */}
      {activeTab === "students" && <StudentRepository />}

      {/* ═══════ TAB 6: GENERALIZED CLASSROOM QUIZ ANALYTICS ═══════ */}
      {activeTab === "reports" && <GradebookAnalytics exams={exams} />}

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

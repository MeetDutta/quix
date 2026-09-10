"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { useExamStore } from "../../../store/examStore";
import { useAuthStore } from "../../../store/authStore";
import { apiFetch, API_V1 } from "../../../lib/api";
import { formatLocalizedDate, formatISTDateTime, formatISTTime } from "../../../lib/dateUtils";
import { useToast } from "../../../components/Toast";
import { 
  AlertCircle, Lock, Timer, Flag, ChevronLeft, ChevronRight, 
  CheckSquare, ShieldAlert, ShieldCheck, CheckCircle2, FileText, Clock, 
  CalendarClock, Calculator, Maximize2, Minimize2, Sparkles,
  ArrowRight, ArrowLeft, RefreshCw, Trophy, Home, Play
} from "lucide-react";
import MathText from "../../../components/MathText";
import ExamCalculator from "../../../components/ExamCalculator";
import ExamHeaderHUD from "./_components/ExamHeaderHUD";
import QuestionPalette from "./_components/QuestionPalette";
import SubmitConfirmModal from "./_components/SubmitConfirmModal";

type ExamStatus = "loading" | "not_started" | "active" | "ended";

export default function ExamPortal() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const examCode = params.exam_code as string;
  const { showToast } = useToast();
  const { token: authToken, role: authRole, fullName: authFullName } = useAuthStore();
  const isTeacherPreviewMode = searchParams.get("mode") === "teacher_preview" || searchParams.get("preview") === "true";

  const examStore = useExamStore();
  const [mounted, setMounted] = useState(false);

  // Exam status state (pre-login)
  const [examStatus, setExamStatus] = useState<ExamStatus>("loading");
  const [examStatusData, setExamStatusData] = useState<any>(null);
  const [countdown, setCountdown] = useState<{ days: number; hours: number; mins: number; secs: number }>({ days: 0, hours: 0, mins: 0, secs: 0 });

  // Login credentials state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [candidateName, setCandidateName] = useState("Candidate");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLogged, setIsLogged] = useState(false);
  const [isSimulation, setIsSimulation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<any | null>(null);

  // Quiz layout states
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [syncStatus, setSyncStatus] = useState<"Synced" | "Saving..." | "Unsynced (Local)">("Synced");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isPaletteMobileOpen, setIsPaletteMobileOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [autoSubmitReason, setAutoSubmitReason] = useState<string | null>(null);
  const [deadlineIST, setDeadlineIST] = useState<string | null>(null);
  const lastSwitchRef = useRef<number>(0);
  const isSubmittingRef = useRef<boolean>(false);

  // Local Storage Backup Key
  const backupKey = `eduquizx_backup_${examCode}`;

  // Check exam status on load OR auto-launch teacher preview simulation
  useEffect(() => {
    setMounted(true);
    const initExamPortal = async () => {
      // 1. If Teacher Simulation Mode
      if (isTeacherPreviewMode && authToken && (authRole === "teacher" || authRole === "inst_admin" || authRole === "super_admin")) {
        setLoading(true);
        try {
          const res = await apiFetch(`/attempts/teacher-preview?exam_code=${examCode}`, {
            method: "POST",
            token: authToken,
          });
          const data = await res.json();
          if (res.ok) {
            examStore.setExamSession(
              data.session_token,
              data.exam_name,
              data.duration_minutes || 30,
              data.questions || [],
              {},
              (data.duration_minutes || 30) * 60
            );
            setCandidateName(data.student_name || "Instructor Simulator");
            setIsSimulation(true);
            setIsLogged(true);
            setExamStatus("active");
            showToast("Teacher Sandbox Simulator initiated. Zero analytics pollution active.", "success");
            return;
          }
        } catch {
          showToast("Failed to initiate teacher preview simulation", "error");
        } finally {
          setLoading(false);
        }
      }

      // 2. Regular Student Exam Status
      try {
        const res = await apiFetch(`/attempts/exam-status?exam_code=${examCode}`);
        const data = await res.json();
        if (res.ok) {
          setExamStatusData(data);
          setExamStatus(data.status as ExamStatus);
        } else {
          setExamStatus("ended");
        }
      } catch {
        setExamStatus("active");
      }
    };

    initExamPortal();
  }, [examCode, isTeacherPreviewMode, authToken, authRole]);

  // Pre-exam countdown timer
  useEffect(() => {
    if (examStatus !== "not_started" || !examStatusData) return;

    let secondsLeft = examStatusData.seconds_until_start;
    const updateCountdown = () => {
      if (secondsLeft <= 0) {
        setExamStatus("active");
        return;
      }
      const d = Math.floor(secondsLeft / 86400);
      const h = Math.floor((secondsLeft % 86400) / 3600);
      const m = Math.floor((secondsLeft % 3600) / 60);
      const s = secondsLeft % 60;
      setCountdown({ days: d, hours: h, mins: m, secs: s });
      secondsLeft--;
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [examStatus, examStatusData]);

  // Local Storage Answer Recovery on Mount
  useEffect(() => {
    if (isLogged && examStore.questions.length > 0) {
      try {
        const savedLocal = localStorage.getItem(backupKey);
        if (savedLocal) {
          const parsed = JSON.parse(savedLocal);
          if (parsed && typeof parsed === "object") {
            Object.entries(parsed).forEach(([qId, ans]) => {
              if (!examStore.answers[qId]) {
                examStore.updateAnswer(qId, ans);
              }
            });
          }
        }
      } catch {}
    }
  }, [isLogged, examStore.questions.length]);

  // Regular Student Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoading(true);

    try {
      const res = await apiFetch(`/attempts/login?exam_code=${examCode}`, {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed");
      }

      setCandidateName(data.student_name || "Student");

      // Fetch exam details
      const infoRes = await apiFetch(`/attempts/exam-info?token=${data.session_token}`);
      const info = await infoRes.json();

      if (infoRes.ok) {
        examStore.setExamSession(
          data.session_token,
          info.exam_name,
          info.duration_minutes,
          info.questions,
          info.saved_answers,
          info.time_remaining_seconds
        );
        if (info.deadline_at_ist) {
          setDeadlineIST(info.deadline_at_ist);
        } else if (info.deadline_at) {
          setDeadlineIST(formatISTTime(info.deadline_at));
        }
        setIsLogged(true);
        showToast("Logged into exam portal securely.", "success");
      }
    } catch (err: any) {
      setLoginError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Authenticated Student Launch Handler
  const handleDirectStudentStart = async () => {
    if (!authToken) return;
    setLoading(true);
    setLoginError(null);
    try {
      const res = await apiFetch(`/attempts/direct-start?exam_code=${examCode}`, {
        method: "POST",
        token: authToken,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to launch exam session");
      }

      setCandidateName(data.student_name || authFullName || "Student");

      // Fetch exam details
      const infoRes = await apiFetch(`/attempts/exam-info?token=${data.session_token}`);
      const info = await infoRes.json();

      if (infoRes.ok) {
        examStore.setExamSession(
          data.session_token,
          info.exam_name,
          info.duration_minutes,
          info.questions,
          info.saved_answers,
          info.time_remaining_seconds
        );
        if (info.deadline_at_ist) {
          setDeadlineIST(info.deadline_at_ist);
        } else if (info.deadline_at) {
          setDeadlineIST(formatISTTime(info.deadline_at));
        }
        setIsLogged(true);
        showToast("Logged into exam portal securely.", "success");
      }
    } catch (err: any) {
      setLoginError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Proctoring logs triggers
  const triggerProctorAlert = async (type: string, details: string) => {
    if (!examStore.sessionToken || isSimulation) return;
    examStore.incrementProctorEvents();
    try {
      await apiFetch(`/attempts/proctor-alert?token=${examStore.sessionToken}`, {
        method: "POST",
        body: JSON.stringify({ event_type: type, event_details: details }),
      });
    } catch {}
  };

  const handleSubmitExam = async () => {
    if (isSubmittingRef.current || submittedResult || !examStore.sessionToken) return;
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const res = await apiFetch(`/attempts/submit?token=${examStore.sessionToken}`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          isSimulation
            ? "Simulation completed!"
            : (autoSubmitReason || (data.status === "auto_submitted" ? "Exam automatically submitted due to tab switching." : "Exam submitted successfully!")),
          "success"
        );
        setSubmittedResult(data);
        setIsLogged(false);
        examStore.clearExamSession();
        try {
          localStorage.removeItem(backupKey);
        } catch {}
      } else {
        showToast(data.detail || "Submission failed", "error");
      }
    } catch {
      showToast("Error submitting exam", "error");
    } finally {
      setLoading(false);
      setShowConfirmModal(false);
      isSubmittingRef.current = false;
    }
  };

  // Periodic Student Heartbeat & Server Authority Sync (Every 12s)
  const sendHeartbeat = useCallback(async () => {
    if (isSubmittingRef.current || !examStore.sessionToken || isSimulation) return;
    try {
      const res = await apiFetch(`/attempts/heartbeat?token=${examStore.sessionToken}`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (
          data.action === "force_submit" ||
          data.force_submit ||
          data.status === "auto_submitted" ||
          data.action === "time_expired" ||
          data.action === "submitted" ||
          data.status === "submitted"
        ) {
          const isTabSwitch = (data.reason || "").toLowerCase().includes("tab") || data.reason === "TAB_SWITCH";
          const message = isTabSwitch
            ? "Exam automatically submitted due to tab switching."
            : (data.reason === "time_expired" ? "Exam deadline reached on server. Finalizing submission..." : "Exam submitted.");
          setAutoSubmitReason(message);
          showToast(message, "warning");
          handleSubmitExam();
        } else if (typeof data.time_remaining_seconds === "number" && Math.abs(examStore.timeRemainingSeconds - data.time_remaining_seconds) > 5) {
          // Reconcile client timer drift with server clock
          examStore.setTimeRemaining(data.time_remaining_seconds);
        }
      }
    } catch {
      // Network temporary drop; client will retry next tick
    }
  }, [examStore.sessionToken, isSimulation, examStore.timeRemainingSeconds]);

  // Listeners for anti-cheat & tab-switches (disabled in teacher simulation)
  useEffect(() => {
    if (!isLogged || submittedResult || isSimulation) return;

    const handleVisibility = async () => {
      if (document.visibilityState === "hidden") {
        const now = Date.now();
        // Debounce multiple visibility events from one physical switch within 1200ms
        if (now - lastSwitchRef.current < 1200) return;
        lastSwitchRef.current = now;

        const clientEventId = typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const payload = {
          type: "TAB_SWITCH",
          client_event_id: clientEventId,
          occurred_at: new Date().toISOString(),
          source: "browser_visibility"
        };

        try {
          // Send server-authoritative violation event with keepalive
          const res = await apiFetch(`/attempts/violation?token=${examStore.sessionToken}`, {
            method: "POST",
            body: JSON.stringify(payload),
            headers: { "Content-Type": "application/json" }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.action === "warn" || data.violation_count === 1) {
              setTabSwitchCount(1);
              showToast(
                "Warning: Tab switching is not allowed. One more tab switch will automatically submit your exam.",
                "error"
              );
            } else if (data.action === "auto_submit" || data.status === "auto_submitted" || data.force_submit) {
              setTabSwitchCount(2);
              setAutoSubmitReason("Exam automatically submitted due to tab switching.");
              showToast("Exam automatically submitted due to tab switching.", "error");
              setSubmittedResult(data.result || {
                status: "auto_submitted",
                score: data.result?.score || 0,
                total_marks: data.result?.total_marks || 50,
                percentage: data.result?.percentage || 0,
                is_passed: false,
                auto_submit_reason: "TAB_SWITCH"
              });
              setIsLogged(false);
              examStore.clearExamSession();
              try {
                localStorage.removeItem(backupKey);
              } catch {}
            }
          }
        } catch {
          // If offline while hidden, the return-to-tab or heartbeat will reconcile authoritative state
        }
      } else if (document.visibilityState === "visible") {
        // Return to tab is NOT a violation. Immediately reconcile authoritative server state!
        sendHeartbeat();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerProctorAlert("contextmenu", "Right-click context menu attempt blocked");
      showToast("Right-click is disabled during exams.", "warning");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (
        e.key === "F12" ||
        (cmdOrCtrl && e.shiftKey && (e.key === "I" || e.key === "i")) ||
        (cmdOrCtrl && e.shiftKey && (e.key === "J" || e.key === "j")) ||
        (cmdOrCtrl && (e.key === "U" || e.key === "u"))
      ) {
        e.preventDefault();
        triggerProctorAlert("devtools", `Developer tools shortcut attempt blocked (${e.key})`);
        showToast("Inspection shortcuts are disabled during exams.", "error");
      }
    };

    const handleCopyPaste = (e: Event) => {
      e.preventDefault();
      triggerProctorAlert("copy_paste", "Copy/paste/cut attempt intercepted");
      showToast("Copy, paste, and cut are disabled during exams.", "warning");
    };

    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);
    document.addEventListener("cut", handleCopyPaste);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
      document.removeEventListener("cut", handleCopyPaste);
    };
  }, [isLogged, submittedResult, isSimulation, examStore.sessionToken, sendHeartbeat]);

  // Exam timer tick
  useEffect(() => {
    if (!isLogged || submittedResult || !examStore.sessionToken || examStore.timeRemainingSeconds <= 0) return;

    const interval = setInterval(() => {
      examStore.decrementTime();
    }, 1000);

    return () => clearInterval(interval);
  }, [isLogged, submittedResult, examStore.sessionToken, examStore.timeRemainingSeconds]);

  // Periodic Student Heartbeat (Every 12s)
  useEffect(() => {
    if (!isLogged || submittedResult || !examStore.sessionToken || isSimulation) return;
    sendHeartbeat();
    const hbInterval = setInterval(sendHeartbeat, 12000);
    return () => clearInterval(hbInterval);
  }, [isLogged, submittedResult, examStore.sessionToken, isSimulation, sendHeartbeat]);

  // Auto-submit on timeout
  useEffect(() => {
    if (
      isLogged &&
      !submittedResult &&
      !isSubmittingRef.current &&
      examStore.sessionToken &&
      examStore.timeRemainingSeconds === 0 &&
      examStore.durationMinutes > 0
    ) {
      showToast("Time expired! Auto-submitting exam...", "warning");
      handleSubmitExam();
    }
  }, [isLogged, submittedResult, examStore.sessionToken, examStore.timeRemainingSeconds, examStore.durationMinutes]);

  // Keyboard Shortcuts (A, B, C, D, ArrowLeft, ArrowRight, F)
  useEffect(() => {
    if (!isLogged || submittedResult || showConfirmModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in a textarea or input!
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;

      const currentQ = examStore.questions[currentIndex];
      if (!currentQ) return;

      const key = e.key.toUpperCase();

      // Navigation
      if (e.key === "ArrowLeft" && currentIndex > 0) {
        e.preventDefault();
        setCurrentIndex((prev) => prev - 1);
      } else if (e.key === "ArrowRight" && currentIndex < examStore.questions.length - 1) {
        e.preventDefault();
        setCurrentIndex((prev) => prev + 1);
      }
      // Flag / Review Toggle
      else if (key === "F" || key === "R") {
        e.preventDefault();
        setFlagged((prev) => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }));
      }
      // Objective Option Selection (A, B, C, D or 1, 2, 3, 4)
      else if (currentQ.options && Array.isArray(currentQ.options)) {
        let selectedIndex = -1;
        if (key === "A" || key === "1") selectedIndex = 0;
        else if (key === "B" || key === "2") selectedIndex = 1;
        else if (key === "C" || key === "3") selectedIndex = 2;
        else if (key === "D" || key === "4") selectedIndex = 3;

        if (selectedIndex >= 0 && selectedIndex < currentQ.options.length) {
          e.preventDefault();
          saveAnswerState(currentQ.id, currentQ.options[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLogged, currentIndex, examStore.questions, submittedResult, showConfirmModal]);

  // Sync answer progress to database and LocalStorage backup
  const saveAnswerState = async (qId: string, answer: any) => {
    examStore.updateAnswer(qId, answer);
    const updatedAnswers = { ...examStore.answers, [qId]: answer };

    // Update LocalStorage Buffer
    try {
      localStorage.setItem(backupKey, JSON.stringify(updatedAnswers));
    } catch {}

    if (isSimulation) {
      setSyncStatus("Synced");
      return;
    }

    setSyncStatus("Saving...");
    try {
      const res = await apiFetch(`/attempts/save-progress?token=${examStore.sessionToken}`, {
        method: "POST",
        body: JSON.stringify(updatedAnswers),
      });
      if (res.ok) {
        setSyncStatus("Synced");
      } else {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 400 && (errData.detail?.includes("expired") || errData.detail?.includes("submitted"))) {
          showToast("Exam deadline reached. Finalizing submission...", "warning");
          handleSubmitExam();
        }
        setSyncStatus("Unsynced (Local)");
      }
    } catch {
      setSyncStatus("Unsynced (Local)");
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const currentQ = examStore.questions[currentIndex];

  // ══════════════════════════════════════════════════════════════════════
  // VIEW 1: PRE-EXAM COUNTDOWN WAITING ROOM
  // ══════════════════════════════════════════════════════════════════════
  if (examStatus === "not_started" && !isLogged) {
    return (
      <div className="min-h-screen bg-[#F7F4EF] dark:bg-[#0E0D0C] flex flex-col items-center justify-center p-4">
        <div className="max-w-lg w-full bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-8 shadow-xl text-center space-y-6 animate-fadeIn">
          <div className="w-14 h-14 bg-[#C84B18]/10 text-[#C84B18] rounded-2xl flex items-center justify-center mx-auto">
            <CalendarClock className="h-7 w-7" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#C84B18] uppercase tracking-wider">Scheduled Assessment</span>
            <h1 className="text-xl font-bold font-serif text-[#242321] dark:text-[#F5F5F4]">
              {examStatusData?.exam_name || "Upcoming Assessment"}
            </h1>
            <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
              This assessment is scheduled. The test room will automatically unlock when the countdown finishes.
            </p>
            {examStatusData?.start_time && (
              <div className="pt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C]">
                  <Clock className="h-3 w-3" />
                  Opens at {formatISTDateTime(examStatusData.start_time)}
                </span>
              </div>
            )}
          </div>

          {/* Countdown Clock */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: "Days", val: countdown.days },
              { label: "Hours", val: countdown.hours },
              { label: "Minutes", val: countdown.mins },
              { label: "Seconds", val: countdown.secs },
            ].map((t) => (
              <div key={t.label} className="bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-3">
                <div className="text-2xl font-bold font-mono text-[#C84B18]">{String(t.val).padStart(2, "0")}</div>
                <div className="text-[10px] font-semibold text-[#716D67] uppercase">{t.label}</div>
              </div>
            ))}
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-left text-xs text-amber-900 dark:text-amber-300 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>Instructions & Pre-flight Checklist</span>
            </div>
            <ul className="list-disc pl-4 text-[11px] space-y-0.5 opacity-90">
              <li>Ensure stable Wi-Fi connection and full battery/power.</li>
              <li>Keep full screen open during the test to avoid proctor flags.</li>
              <li>Strict Anti-Cheat: Only 1 tab switch is allowed. A second switch will auto-submit.</li>
              <li>Have your candidate PIN/passcode ready for instant login.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // VIEW 2: CANDIDATE LOGIN & PASSCODE GATEWAY
  // ══════════════════════════════════════════════════════════════════════
  if (!isLogged && !submittedResult) {
    return (
      <div className="min-h-screen bg-[#F7F4EF] dark:bg-[#0E0D0C] flex flex-col items-center justify-center p-3 sm:p-4">
        <div className="max-w-md w-full bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-5 sm:p-8 shadow-xl space-y-5 sm:space-y-6 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#C84B18]/10 text-[#C84B18] rounded-xl flex items-center justify-center font-bold font-serif text-lg shrink-0">
              EQ
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-[#242321] dark:text-[#F5F5F4] truncate">Candidate Examination Gateway</h1>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] truncate">
                Assessment Code: <b className="font-mono text-[#C84B18]">{examCode}</b>
              </p>
            </div>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          {/* 1-Click Direct Start for Authenticated User */}
          {mounted && authToken && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Authenticated Account Detected</span>
                </div>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                You are logged in. Click below to begin immediately with your profile:
              </p>
              <button
                type="button"
                onClick={handleDirectStudentStart}
                disabled={loading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Preparing Exam Room...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current shrink-0" />
                    <span className="truncate">Launch Exam as {authFullName || "Student"}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {mounted && authToken && (
            <div className="relative flex items-center justify-center">
              <div className="border-t border-[#E5E0D8] dark:border-[#292524] w-full" />
              <span className="bg-white dark:bg-[#171615] px-3 text-[10px] font-bold text-[#716D67] uppercase tracking-wider shrink-0">
                or enter candidate passcode
              </span>
              <div className="border-t border-[#E5E0D8] dark:border-[#292524] w-full" />
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#242321] dark:text-[#F5F5F4]">
                Registered Candidate Email / Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. student@institution.edu"
                className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg px-3 py-2.5 text-xs text-[#242321] dark:text-[#F5F5F4] focus:ring-1 focus:ring-[#C84B18] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#242321] dark:text-[#F5F5F4]">
                Timed Access PIN / Passcode
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter 6-digit access passcode"
                className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg px-3 py-2.5 text-xs text-[#242321] dark:text-[#F5F5F4] font-mono tracking-wider focus:ring-1 focus:ring-[#C84B18] focus:outline-none"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Authenticate & Launch Exam</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-[#E5E0D8] dark:border-[#292524] text-center text-[11px] text-[#716D67]">
            EduQuizX AI Proctoring Active • Fullscreen lockdown enabled
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // VIEW 3: COMPLETED RESULT SCORECARD
  // ══════════════════════════════════════════════════════════════════════
  if (submittedResult) {
    const isPass = submittedResult.is_passed;
    return (
      <div className="min-h-screen bg-[#F7F4EF] dark:bg-[#0E0D0C] flex flex-col items-center justify-center p-3 sm:p-4">
        <div className="max-w-xl w-full bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-5 sm:p-8 shadow-2xl space-y-5 sm:space-y-6 text-center animate-fadeIn">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${
            isPass ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40" : "bg-rose-100 text-rose-600 dark:bg-rose-950/40"
          }`}>
            <Trophy className="h-8 w-8" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#C84B18] uppercase tracking-wider">
              {isSimulation ? "Teacher Sandbox Simulation Result" : "Examination Result Summary"}
            </span>
            <h1 className="text-2xl font-bold font-serif text-[#242321] dark:text-[#F5F5F4]">
              {submittedResult?.status === "auto_submitted" || submittedResult?.auto_submit_reason === "TAB_SWITCH"
                ? "Exam Auto-Submitted"
                : (isPass ? "Assessment Passed!" : "Assessment Completed")}
            </h1>
            <p className="text-xs text-[#716D67] dark:text-[#A8A29E] font-medium">
              {submittedResult?.status === "auto_submitted" || submittedResult?.auto_submit_reason === "TAB_SWITCH" || autoSubmitReason?.toLowerCase().includes("tab")
                ? "Exam automatically submitted due to tab switching."
                : (autoSubmitReason || "Your responses have been evaluated and recorded.")}
            </p>
          </div>

          {/* Score Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524]">
              <div className="text-xs font-medium text-[#716D67] uppercase">Score Earned</div>
              <div className="text-2xl font-bold text-[#C84B18] mt-1">
                {submittedResult.score} <span className="text-xs text-[#716D67] font-normal">/ {submittedResult.total_marks || 50}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524]">
              <div className="text-xs font-medium text-[#716D67] uppercase">Percentage</div>
              <div className="text-2xl font-bold text-[#242321] dark:text-[#F5F5F4] mt-1">
                {submittedResult.percentage}%
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] col-span-2 sm:col-span-1">
              <div className="text-xs font-medium text-[#716D67] uppercase">Outcome</div>
              <div className={`text-xl font-bold mt-1.5 ${isPass ? "text-emerald-600" : "text-rose-600"}`}>
                {isPass ? "PASSED" : "FAILED"}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {isSimulation ? (
              <button
                onClick={() => router.push("/dashboard/teacher#exams")}
                className="btn-primary w-full sm:w-auto px-6 py-2.5 text-xs font-bold flex items-center justify-center gap-2"
              >
                <Home className="h-4 w-4" />
                <span>Return to Teacher Studio</span>
              </button>
            ) : (
              <button
                onClick={() => router.push("/dashboard/student")}
                className="btn-primary w-full sm:w-auto px-6 py-2.5 text-xs font-bold flex items-center justify-center gap-2"
              >
                <Home className="h-4 w-4" />
                <span>Return to Student Portal</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // VIEW 4: LIVE DISTRACTION-FREE EXAM TAKING ARENA
  // ══════════════════════════════════════════════════════════════════════
  const answeredCount = examStore.questions.filter((q) => {
    const a = examStore.answers[q.id];
    return a !== undefined && a !== null && String(a).trim() !== "";
  }).length;

  return (
    <div className="min-h-screen bg-[#F7F4EF] dark:bg-[#0E0D0C] flex flex-col pb-28 lg:pb-6">
      {/* Top HUD Bar */}
      <ExamHeaderHUD
        examName={examStore.examName || "Assessment"}
        candidateName={candidateName}
        timeRemainingSeconds={examStore.timeRemainingSeconds}
        deadlineIST={deadlineIST || undefined}
        syncStatus={syncStatus}
        isCalculatorOpen={isCalculatorOpen}
        onToggleCalculator={() => setIsCalculatorOpen((prev) => !prev)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        isSimulation={isSimulation}
        onExitSimulation={() => router.push("/dashboard/teacher#exams")}
        tabSwitchCount={tabSwitchCount}
        proctorEventCount={examStore.proctorEventsCount}
        onTogglePalette={() => setIsPaletteMobileOpen(true)}
        answeredCount={answeredCount}
        totalQuestions={examStore.questions.length}
      />

      {/* Tab Switch Strike 1 Warning Banner */}
      {tabSwitchCount === 1 && (
        <div className="bg-rose-600 text-white px-3 sm:px-4 py-2.5 sm:py-3 text-xs font-bold shadow-md animate-pulse border-b border-rose-700">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-center text-center">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              Warning: Tab switching is not allowed. One more tab switch will automatically submit your exam.
            </span>
          </div>
        </div>
      )}

      {/* Main Exam Arena Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Left / Center: Question Panel (8 cols on desktop, full width on mobile) */}
        <div className="lg:col-span-8 space-y-4">
          {currentQ ? (
            <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-4 sm:p-6 shadow-xs space-y-5 sm:space-y-6">
              {/* Question Header & Controls */}
              <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-3 sm:pb-4">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-[#C84B18]/10 text-[#C84B18] font-mono font-bold text-xs">
                    Question {currentIndex + 1} of {examStore.questions.length}
                  </span>
                  <span className="text-xs text-[#716D67] font-semibold">
                    {currentQ.marks || 1} Mark{currentQ.marks > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  {examStore.answers[currentQ.id] && (
                    <button
                      type="button"
                      onClick={() => saveAnswerState(currentQ.id, null)}
                      className="px-2 sm:px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#716D67] hover:text-rose-600 dark:hover:text-rose-400 border border-dashed border-[#E5E0D8] dark:border-[#292524] transition-all cursor-pointer"
                      title="Clear your selected answer"
                    >
                      <span>Clear</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setFlagged((prev) => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }))
                    }
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
                      flagged[currentQ.id]
                        ? "bg-purple-100 dark:bg-purple-950/40 border-purple-300 text-purple-900 dark:text-purple-300"
                        : "border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] dark:hover:text-white"
                    }`}
                  >
                    <Flag className="h-3.5 w-3.5" />
                    <span className="hidden xs:inline">{flagged[currentQ.id] ? "Marked" : "Mark for Review"}</span>
                    <span className="xs:hidden">{flagged[currentQ.id] ? "Marked" : "Review"}</span>
                  </button>
                </div>
              </div>

              {/* Question Stem (MathText LaTeX support) */}
              <div className="text-sm sm:text-base font-medium text-[#242321] dark:text-[#F5F5F4] leading-relaxed">
                <MathText text={currentQ.question_text || "No question stem provided."} />
              </div>

              {/* Optional Code Snippet Block */}
              {currentQ.code_snippet && (
                <div className="rounded-xl bg-[#1E1E1E] text-[#D4D4D4] p-3.5 sm:p-4 overflow-x-auto border border-[#333] font-mono text-xs leading-relaxed my-2 shadow-inner">
                  {currentQ.code_language && (
                    <div className="text-[10px] text-stone-400 uppercase tracking-widest pb-1.5 border-b border-stone-700/60 mb-2 font-bold flex items-center justify-between">
                      <span>{currentQ.code_language}</span>
                      <span className="text-[9px] lowercase bg-stone-800 text-stone-300 px-2 py-0.5 rounded font-sans">syntax preview</span>
                    </div>
                  )}
                  <pre className="whitespace-pre overflow-x-auto"><code>{currentQ.code_snippet}</code></pre>
                </div>
              )}

              {/* Option Cards for MCQs / Objective */}
              {currentQ.options && Array.isArray(currentQ.options) && currentQ.options.length > 0 ? (
                <div className="space-y-2.5 pt-2">
                  {currentQ.options.map((opt: string, optIdx: number) => {
                    const isSelected = examStore.answers[currentQ.id] === opt;
                    const letter = String.fromCharCode(65 + optIdx); // A, B, C, D

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => saveAnswerState(currentQ.id, opt)}
                        className={`w-full text-left p-3 sm:p-3.5 rounded-xl border transition-all flex items-center gap-3 sm:gap-3.5 cursor-pointer ${
                          isSelected
                            ? "bg-[#C84B18]/10 border-[#C84B18] text-[#242321] dark:text-[#F5F5F4] shadow-xs font-semibold ring-1 ring-[#C84B18]"
                            : "bg-[#F7F4EF]/50 dark:bg-[#141312] border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E] hover:border-[#C84B18]/50 hover:text-[#242321] dark:hover:text-white"
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 border ${
                            isSelected
                              ? "bg-[#C84B18] text-white border-[#C84B18]"
                              : "border-[#E5E0D8] dark:border-[#292524] text-[#716D67]"
                          }`}
                        >
                          {letter}
                        </div>
                        <div className="text-xs sm:text-sm flex-1 min-w-0 break-words">
                          <MathText text={opt} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Descriptive / Subjective Answer Area */
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-semibold text-[#716D67] uppercase">
                    Your Descriptive Response
                  </label>
                  <textarea
                    rows={6}
                    value={examStore.answers[currentQ.id] || ""}
                    onChange={(e) => saveAnswerState(currentQ.id, e.target.value)}
                    placeholder="Type your structured explanation, proofs, or calculations here..."
                    className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-3 sm:p-4 text-xs sm:text-sm text-[#242321] dark:text-[#F5F5F4] focus:ring-1 focus:ring-[#C84B18] focus:outline-none"
                  />
                  <div className="flex justify-between text-[11px] text-[#716D67]">
                    <span>AI auto-evaluation active upon submission</span>
                    <span>{(examStore.answers[currentQ.id] || "").trim().split(/\s+/).filter(Boolean).length} words</span>
                  </div>
                </div>
              )}

              {/* Desktop Bottom Navigation Buttons */}
              <div className="hidden lg:flex items-center justify-between border-t border-[#E5E0D8] dark:border-[#292524] pt-4">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => prev - 1)}
                  className="px-4 py-2 rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-xs font-semibold text-[#716D67] hover:text-[#242321] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Previous</span>
                </button>

                {/* Clear Selection Button */}
                {examStore.answers[currentQ.id] && (
                  <button
                    type="button"
                    onClick={() => saveAnswerState(currentQ.id, null)}
                    className="text-[11px] font-semibold text-[#716D67] hover:text-[#C84B18] transition-all cursor-pointer"
                  >
                    Clear Selection
                  </button>
                )}

                {currentIndex < examStore.questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((prev) => prev + 1)}
                    className="btn-primary px-5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Next Question</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(true)}
                    className="btn-primary px-6 py-2 text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <span>Review & Submit</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-12 text-center text-xs text-[#716D67]">
              No questions found for this assessment.
            </div>
          )}
        </div>

        {/* Right: Question Palette & Review Matrix (Visible on Large Screens) */}
        <div className="hidden lg:block lg:col-span-4 space-y-4">
          <QuestionPalette
            questions={examStore.questions}
            currentIndex={currentIndex}
            answers={examStore.answers}
            flagged={flagged}
            onSelectQuestion={(idx) => setCurrentIndex(idx)}
          />

          {/* Quick Finish / Submit Action Card */}
          <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-5 space-y-3 shadow-xs">
            <h4 className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4] uppercase tracking-wider">
              Assessment Completion
            </h4>
            <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">
              Done with all questions? Open the confirmation checklist to finalize and submit.
            </p>
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <CheckSquare className="h-4 w-4" />
              <span>Finish & Submit Exam</span>
            </button>
          </div>
        </div>
      </main>

      {/* Mobile Sticky Bottom Action Toolbar (Thumb Reachable) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-[#FFFFFF]/95 dark:bg-[#171615]/95 border-t border-[#E5E0D8] dark:border-[#292524] backdrop-blur-md px-3 py-2 pb-safe z-30 flex items-center justify-between gap-2 shadow-lg">
        <button
          type="button"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((prev) => prev - 1)}
          className="p-2.5 rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-xs font-semibold text-[#716D67] hover:text-[#242321] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden xs:inline">Prev</span>
        </button>

        <button
          type="button"
          onClick={() => setIsPaletteMobileOpen(true)}
          className="px-3 py-2 rounded-xl border border-[#E5E0D8] dark:border-[#292524] bg-[#F7F4EF] dark:bg-[#1D1B19] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <span>Palette</span>
          <span className="px-1.5 py-0.5 rounded-full bg-[#C84B18] text-white text-[10px]">
            {answeredCount}/{examStore.questions.length}
          </span>
        </button>

        {currentIndex < examStore.questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setCurrentIndex((prev) => prev + 1)}
            className="btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-md bg-emerald-600 hover:bg-emerald-700"
          >
            <span>Submit</span>
            <CheckSquare className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Mobile Question Palette Bottom Sheet Drawer */}
      {isPaletteMobileOpen && (
        <div 
          onClick={() => setIsPaletteMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center p-0 animate-fadeIn"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-[#FFFFFF] dark:bg-[#171615] rounded-t-2xl max-h-[85vh] overflow-hidden shadow-2xl pb-safe border-t border-[#E5E0D8] dark:border-[#292524]"
          >
            {/* Mobile Sheet Drag / Dismiss Indicator */}
            <div className="w-12 h-1.5 bg-stone-300 dark:bg-stone-700 rounded-full mx-auto my-2 shrink-0" />
            <QuestionPalette
              questions={examStore.questions}
              currentIndex={currentIndex}
              answers={examStore.answers}
              flagged={flagged}
              onSelectQuestion={(idx) => setCurrentIndex(idx)}
              isMobileModal={true}
              onCloseMobileModal={() => setIsPaletteMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Floating Scientific Calculator Modal */}
      {isCalculatorOpen && (
        <ExamCalculator isOpen={isCalculatorOpen} onClose={() => setIsCalculatorOpen(false)} />
      )}

      {/* Pre-Submission Confirmation Modal */}
      {showConfirmModal && (
        <SubmitConfirmModal
          questions={examStore.questions}
          answers={examStore.answers}
          flagged={flagged}
          onConfirm={handleSubmitExam}
          onCancel={() => setShowConfirmModal(false)}
          loading={loading}
        />
      )}
    </div>
  );
}


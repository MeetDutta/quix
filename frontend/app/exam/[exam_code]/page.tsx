"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useExamStore } from "../../../store/examStore";
import { apiFetch } from "../../../lib/api";
import { useToast } from "../../../components/Toast";
import { AlertCircle, Lock, Timer, Flag, ChevronLeft, ChevronRight, CheckSquare, ShieldAlert, CheckCircle2, FileText, Clock, CalendarClock, Calculator } from "lucide-react";
import MathText from "../../../components/MathText";
import ExamCalculator from "../../../components/ExamCalculator";

type ExamStatus = "loading" | "not_started" | "active" | "ended";

export default function ExamPortal() {
  const params = useParams();
  const router = useRouter();
  const examCode = params.exam_code as string;
  const { showToast } = useToast();

  const examStore = useExamStore();

  // Exam status state (pre-login)
  const [examStatus, setExamStatus] = useState<ExamStatus>("loading");
  const [examStatusData, setExamStatusData] = useState<any>(null);
  const [countdown, setCountdown] = useState<{ days: number; hours: number; mins: number; secs: number }>({ days: 0, hours: 0, mins: 0, secs: 0 });

  // Login credentials state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLogged, setIsLogged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<any | null>(null);

  // Quiz layout states
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [syncStatus, setSyncStatus] = useState("Synced");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [autoSubmitReason, setAutoSubmitReason] = useState<string | null>(null);

  // Check exam status on load
  useEffect(() => {
    const checkStatus = async () => {
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
        setExamStatus("active"); // Fallback: show login form
      }
    };
    checkStatus();
  }, [examCode]);

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

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoading(true);

    try {
      const res = await apiFetch(`/attempts/login?exam_code=${examCode}`, {
        method: "POST",
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed");
      }

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
          info.time_remaining_seconds // Use server-calculated time
        );
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
    if (!examStore.sessionToken) return;
    examStore.incrementProctorEvents();
    try {
      await apiFetch(`/attempts/proctor-alert?token=${examStore.sessionToken}`, {
        method: "POST",
        body: JSON.stringify({ event_type: type, event_details: details })
      });
    } catch (e) { }
  };

  // Listeners for proctoring triggers
  useEffect(() => {
    if (!isLogged) return;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        setTabSwitchCount((prev) => {
          const nextCount = prev + 1;
          triggerProctorAlert("tab_switch", `Tab switch violation #${nextCount} of 3 recorded.`);
          if (nextCount >= 3) {
            setAutoSubmitReason("Maximum tab-switch violations reached (3/3). Your exam has been automatically submitted due to anti-cheat policy.");
            showToast("CRITICAL PROCTORING VIOLATION: 3 tab switches detected! Auto-submitting exam now...", "error");
            // Auto submit immediately
            setTimeout(() => {
              handleSubmitExam();
            }, 100);
          } else {
            showToast(`Proctoring Warning: Tab switch ${nextCount}/3 detected! Reaching 3 tab switches will automatically submit your exam.`, "warning");
          }
          return nextCount;
        });
      }
    };

    const handleCopyPaste = (e: Event) => {
      e.preventDefault();
      triggerProctorAlert("copy_paste", "Copy/paste attempt intercepted");
      showToast("Copy/Paste is disabled during exams.", "warning");
    };

    const handleResize = () => {
      triggerProctorAlert("resize", `Window size updated to ${window.innerWidth}x${window.innerHeight}`);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
      window.removeEventListener("resize", handleResize);
    };
  }, [isLogged]);

  // Exam timer tick
  useEffect(() => {
    if (!isLogged || examStore.timeRemainingSeconds <= 0) return;

    const interval = setInterval(() => {
      examStore.decrementTime();
    }, 1000);

    return () => clearInterval(interval);
  }, [isLogged, examStore.timeRemainingSeconds]);

  // Auto-submit on timeout
  useEffect(() => {
    if (isLogged && examStore.timeRemainingSeconds === 0) {
      showToast("Time expired! Auto-submitting exam...", "warning");
      handleSubmitExam();
    }
  }, [isLogged, examStore.timeRemainingSeconds]);

  // Sync answer progress to database
  const saveAnswerState = async (qId: string, answer: any) => {
    examStore.updateAnswer(qId, answer);
    setSyncStatus("Saving...");
    try {
      const updatedAnswers = { ...examStore.answers, [qId]: answer };
      const res = await apiFetch(`/attempts/save-progress?token=${examStore.sessionToken}`, {
        method: "POST",
        body: JSON.stringify(updatedAnswers)
      });
      if (res.ok) setSyncStatus("Synced");
    } catch (e) {
      setSyncStatus("Unsynced (Local)");
    }
  };

  const handleSubmitExam = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/attempts/submit?token=${examStore.sessionToken}`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Exam submitted successfully!", "success");
        setSubmittedResult(data);
        examStore.clearExamSession();
      } else {
        showToast(data.detail || "Submission failed", "error");
      }
    } catch (e) {
      showToast("Error submitting exam", "error");
    } finally {
      setLoading(false);
      setShowConfirmModal(false);
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const toggleFlag = (qId: string) => {
    setFlagged(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  // ═══════ LOADING STATE ═══════
  if (examStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="animate-pulse text-center space-y-3">
          <div className="inline-flex p-4 rounded-2xl bg-[#FCEBE6] text-[#9A3412] border border-[#F7D5CA]">
            <Clock className="h-8 w-8 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-[#78716C]">Checking exam status...</p>
        </div>
      </div>
    );
  }

  // ═══════ PRE-EXAM COUNTDOWN WAITING ROOM ═══════
  if (examStatus === "not_started" && !isLogged) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <div className="bg-white border border-[#E7E0D3] rounded-2xl p-8 max-w-lg w-full text-center space-y-8 shadow-sm">
          <div className="space-y-3">
            <div className="inline-flex p-4 rounded-2xl bg-[#FCEBE6] text-[#9A3412] border border-[#F7D5CA]">
              <CalendarClock className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-[#1C1917]">Exam Not Started Yet</h1>
            <p className="text-sm text-[#78716C]">
              <span className="font-semibold text-[#9A3412]">{examStatusData?.exam_name}</span> is scheduled to begin soon.
            </p>
          </div>

          {/* Countdown Grid */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Days", value: countdown.days },
              { label: "Hours", value: countdown.hours },
              { label: "Minutes", value: countdown.mins },
              { label: "Seconds", value: countdown.secs },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#FBF9F5] border border-[#E7E0D3] rounded-xl p-3 space-y-1">
                <div className="text-3xl font-extrabold text-[#9A3412] tabular-nums font-mono">
                  {value.toString().padStart(2, "0")}
                </div>
                <div className="text-[10px] font-bold text-[#78716C] uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>

          {/* Progress bar animation */}
          <div className="w-full bg-[#E7E0D3] rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#9A3412] to-[#C2410C] rounded-full transition-all duration-1000"
              style={{ width: `${Math.max(2, 100 - ((countdown.days * 86400 + countdown.hours * 3600 + countdown.mins * 60 + countdown.secs) / Math.max(1, examStatusData?.seconds_until_start || 1)) * 100)}%` }}
            />
          </div>

          <div className="space-y-2 text-xs text-[#78716C]">
            <div className="flex items-center justify-center gap-2">
              <Timer className="h-3.5 w-3.5 text-[#9A3412]" />
              <span>Duration: <b className="text-[#1C1917]">{examStatusData?.duration_minutes} minutes</b></span>
            </div>
            <p>The login form will appear automatically when the exam opens. Please stay on this page.</p>
          </div>
        </div>
      </div>
    );
  }

  // ═══════ EXAM ENDED STATE ═══════
  if (examStatus === "ended" && !isLogged) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <div className="bg-white border border-[#E7E0D3] rounded-2xl p-8 max-w-lg w-full text-center space-y-6 shadow-sm">
          <div className="inline-flex p-4 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200">
            <AlertCircle className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1C1917]">Exam Has Ended</h1>
            <p className="text-sm text-[#78716C] mt-2">
              The examination window for <b className="text-[#9A3412]">{examStatusData?.exam_name || examCode}</b> has closed.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/student")}
            className="bg-[#FBF9F5] border border-[#E7E0D3] text-[#292524] font-semibold rounded-xl py-3 px-6 text-xs hover:bg-[#F3EDE2] transition-all"
          >
            Go to Student Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ═══════ SUBMISSION RESULT SCREEN ═══════
  if (submittedResult) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <div className="bg-white border border-[#E7E0D3] rounded-2xl p-8 max-w-lg w-full text-center space-y-6 shadow-sm">
          <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl w-16 h-16 mx-auto flex items-center justify-center border border-emerald-200">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1C1917]">Exam Submitted Successfully!</h1>
            <p className="text-xs text-[#78716C] mt-1">Your responses have been evaluated and recorded.</p>
          </div>

          {autoSubmitReason && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3.5 text-xs text-left flex items-start gap-2.5 animate-fadeIn">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-bold">Anti-Cheat Auto-Submission</p>
                <p className="text-[11px] text-rose-700 mt-0.5">{autoSubmitReason}</p>
              </div>
            </div>
          )}

          <div className="bg-[#FBF9F5] border border-[#E7E0D3] rounded-xl p-4 flex items-center justify-around">
            <div>
              <div className="text-2xl font-extrabold text-[#9A3412]">{submittedResult.score}</div>
              <span className="text-[11px] font-bold text-[#78716C] uppercase tracking-wider">Score Obtained</span>
            </div>
            <div className="h-8 w-px bg-[#E7E0D3]" />
            <div>
              <div className="text-2xl font-extrabold text-[#9A3412]">{submittedResult.percentage.toFixed(1)}%</div>
              <span className="text-[11px] font-bold text-[#78716C] uppercase tracking-wider">Percentage</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <a
              href={`http://localhost:8000/api/v1/reports/submission-detail/${submittedResult.submission_id}/printable`}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-gradient-to-r from-[#9A3412] to-[#C2410C] text-white font-bold rounded-xl py-3 text-xs shadow-sm hover:from-[#7C2D12] hover:to-[#9A3412] transition-all flex items-center justify-center gap-2"
            >
              <FileText className="h-4 w-4" />
              <span>Download / Print Response Booklet (with Correct Answers)</span>
            </a>

            <button
              onClick={() => router.push("/dashboard/student")}
              className="w-full bg-[#FBF9F5] border border-[#E7E0D3] text-[#292524] font-semibold rounded-xl py-3 text-xs hover:bg-[#F3EDE2] transition-all"
            >
              Go to Student Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════ LOGIN FORM ═══════
  if (!isLogged) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2] p-4">
        <div className="w-full max-w-md bg-white rounded-2xl p-8 border border-[#E7E0D3] shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-[#9A3412] text-white mb-2">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-[#1C1917]">Isolated Exam Portal</h1>
            <p className="text-xs text-[#78716C]">Exam Code: <span className="font-mono font-bold text-[#9A3412]">{examCode}</span></p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#57534E] uppercase">EXAM USERNAME</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. std_alex_123"
                className="w-full bg-[#FBF9F5] border border-[#E7E0D3] rounded-xl px-3.5 py-2.5 text-sm text-[#1C1917] focus:ring-2 focus:ring-[#9A3412]/30 focus:border-[#9A3412]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#57534E] uppercase">SESSION PASSCODE</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6-digit passcode"
                className="w-full bg-[#FBF9F5] border border-[#E7E0D3] rounded-xl px-3.5 py-2.5 text-sm text-[#1C1917] focus:ring-2 focus:ring-[#9A3412]/30 focus:border-[#9A3412]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#9A3412] to-[#C2410C] text-white font-bold rounded-xl py-3 text-xs shadow-sm hover:from-[#7C2D12] hover:to-[#9A3412] transition-all"
            >
              {loading ? "Authenticating..." : "Start Secured Exam Session"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ═══════ ACTIVE EXAM VIEW ═══════
  const currentQ = examStore.questions[currentIndex];
  const isUrgent = examStore.timeRemainingSeconds < 300; // < 5 mins
  const answeredCount = Object.keys(examStore.answers).length;

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col selection:bg-none select-none">
      {/* ═══════ TOP HEADER & TIMER BAR ═══════ */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#E7E0D3] px-3 sm:px-6 py-2.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="font-extrabold text-[#1C1917] text-sm sm:text-base truncate max-w-[140px] sm:max-w-xs">{examStore.examName}</div>
            <span className="text-xs text-[#78716C] bg-[#F5F0E8] border border-[#E7E0D3] px-2.5 py-1 rounded-full font-mono">
              Q{currentIndex + 1} / {examStore.questions.length}
            </span>
          </div>

          {/* Real-time Timer display */}
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border text-sm font-extrabold font-mono transition-all ${isUrgent
              ? "bg-rose-50 border-rose-300 text-rose-700 animate-pulse"
              : "bg-[#FCEBE6] border-[#F7D5CA] text-[#9A3412]"
            }`}>
            <Timer className="h-4 w-4 shrink-0" />
            <span>{formatTime(examStore.timeRemainingSeconds)}</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="hidden sm:flex items-center gap-1 text-[#78716C]">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{syncStatus}</span>
            </span>

            {examStore.proctorEventsCount > 0 && (
              <span className="flex items-center gap-1 text-rose-600 font-bold bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>{examStore.proctorEventsCount} Alerts</span>
              </span>
            )}

            {/* Tab Strikes Anti-Cheat Pill (Auto-submit at 3) */}
            <span className={`flex items-center gap-1 font-bold px-2.5 py-1 rounded-full transition-all ${
              tabSwitchCount >= 2 
                ? "bg-rose-100 text-rose-700 border border-rose-300 animate-pulse" 
                : tabSwitchCount === 1 
                ? "bg-amber-50 text-amber-700 border border-amber-300" 
                : "bg-[#F5F0E8] text-[#78716C] border border-[#E7E0D3]"
            }`}>
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Tab Strikes: {tabSwitchCount}/3</span>
            </span>

            {/* In-Exam Calculator Tool Button */}
            <button
              type="button"
              onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                isCalculatorOpen
                  ? "bg-[#9A3412] text-white border-[#9A3412] shadow-xs"
                  : "bg-[#FBF9F5] border-[#E7E0D3] text-[#292524] hover:bg-[#F3EDE2]"
              }`}
              title="Open Interactive Calculator"
            >
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">Calculator</span>
            </button>

            <button
              onClick={() => setShowConfirmModal(true)}
              className="bg-gradient-to-r from-[#9A3412] to-[#C2410C] text-white text-xs font-bold px-4 py-2 rounded-xl hover:from-[#7C2D12] hover:to-[#9A3412] transition-all shadow-xs"
            >
              Finish Exam
            </button>
          </div>
        </div>
      </header>

      {/* ═══════ MAIN EXAM WORKSPACE ═══════ */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center Question Card */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-[#E7E0D3] rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#F0E8DD]">
              <div>
                <span className="text-[11px] font-bold text-[#9A3412] uppercase tracking-wider">
                  Question {currentIndex + 1} of {examStore.questions.length} • {currentQ?.marks || 1} Marks
                </span>
                <h2 className="text-lg font-bold text-[#1C1917] mt-1 leading-snug">
                  <MathText text={currentQ?.question_text || ""} />
                </h2>
              </div>

              {/* Flag button */}
              <button
                onClick={() => toggleFlag(currentQ?.id)}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${flagged[currentQ?.id]
                    ? "bg-amber-50 border-amber-300 text-amber-700"
                    : "bg-[#FBF9F5] border-[#E7E0D3] text-[#78716C] hover:text-[#1C1917]"
                  }`}
              >
                <Flag className={`h-4 w-4 ${flagged[currentQ?.id] ? "fill-amber-500" : ""}`} />
                <span className="hidden sm:inline">{flagged[currentQ?.id] ? "Flagged" : "Flag"}</span>
              </button>
            </div>

            {/* Answer Options / Response area */}
            <div className="space-y-3">
              {(Array.isArray(currentQ?.options) && currentQ.options.length > 0) || ["mcq", "tf", "true_false", "choice"].includes(String(currentQ?.question_type || "").toLowerCase()) ? (
                (currentQ?.options || ["True", "False"]).map((opt: string, i: number) => {
                  const isSelected = examStore.answers[currentQ.id] === opt;
                  return (
                    <button
                      key={i}
                      onClick={() => saveAnswerState(currentQ.id, opt)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3.5 ${isSelected
                          ? "bg-[#FCEBE6] border-[#9A3412] text-[#9A3412] font-semibold shadow-xs"
                          : "bg-[#FBF9F5] border-[#E7E0D3] text-[#292524] hover:bg-[#F3EDE2]"
                        }`}
                    >
                      <div className={`h-6 w-6 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${isSelected ? "border-[#9A3412] bg-[#9A3412] text-white" : "border-[#A8A29E] text-[#78716C]"
                        }`}>
                        {String.fromCharCode(65 + i)}
                      </div>
                      <span className="text-sm"><MathText text={opt} /></span>
                    </button>
                  );
                })
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#78716C] uppercase">YOUR SUBJECTIVE ANSWER</label>
                  <textarea
                    rows={6}
                    value={examStore.answers[currentQ?.id] || ""}
                    onChange={(e) => saveAnswerState(currentQ.id, e.target.value)}
                    placeholder="Type your answer clearly here. AI will evaluate response logic against rubric..."
                    className="w-full bg-[#FBF9F5] border border-[#E7E0D3] rounded-xl p-4 text-sm text-[#1C1917] focus:ring-2 focus:ring-[#9A3412]/30 focus:border-[#9A3412]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Prev / Next Navigation Controls */}
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="bg-white border border-[#E7E0D3] text-[#292524] font-semibold text-xs px-5 py-3 rounded-xl hover:bg-[#F3EDE2] transition-all disabled:opacity-40 flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" /> Previous Question
            </button>

            <button
              onClick={() => setCurrentIndex(prev => Math.min(examStore.questions.length - 1, prev + 1))}
              disabled={currentIndex === examStore.questions.length - 1}
              className="bg-gradient-to-r from-[#9A3412] to-[#C2410C] text-white font-bold text-xs px-6 py-3 rounded-xl hover:from-[#7C2D12] hover:to-[#9A3412] transition-all disabled:opacity-40 flex items-center gap-2 shadow-xs"
            >
              Next Question <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Right Question Palette Grid */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white border border-[#E7E0D3] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#F0E8DD] pb-3">
              <h3 className="font-bold text-sm text-[#1C1917]">Question Palette</h3>
              <span className="text-xs text-[#78716C] font-semibold">{answeredCount} / {examStore.questions.length} Answered</span>
            </div>

            {/* Grid Palette buttons */}
            <div className="grid grid-cols-5 gap-2">
              {examStore.questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = examStore.answers[q.id] !== undefined && examStore.answers[q.id] !== "";
                const isFlagged = flagged[q.id];

                let btnStyle = "bg-[#FBF9F5] border-[#E7E0D3] text-[#78716C]";
                if (isAnswered) btnStyle = "bg-emerald-50 border-emerald-300 text-emerald-800 font-bold";
                if (isFlagged) btnStyle = "bg-amber-50 border-amber-300 text-amber-800 font-bold";
                if (isCurrent) btnStyle += " ring-2 ring-[#9A3412] ring-offset-1";

                return (
                  <button
                    key={q.id || idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-10 rounded-xl border text-xs flex items-center justify-center transition-all relative ${btnStyle}`}
                  >
                    {idx + 1}
                    {isFlagged && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-3 border-t border-[#F0E8DD] space-y-2 text-[11px] text-[#78716C]">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /><span>Answered</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /><span>Flagged for Review</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-[#FBF9F5] border border-[#E7E0D3]" /><span>Unanswered</span></div>
            </div>
          </div>
        </div>
      </main>

      {/* ═══════ SUBMIT CONFIRMATION MODAL ═══════ */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-[#E7E0D3] shadow-xl space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-full bg-[#FCEBE6] text-[#9A3412] mb-1">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-[#1C1917]">Submit Examination?</h3>
              <p className="text-xs text-[#78716C]">
                You have answered <b className="text-[#9A3412]">{answeredCount}</b> out of <b>{examStore.questions.length}</b> questions. Once submitted, you cannot change your answers.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 bg-[#FBF9F5] border border-[#E7E0D3] text-[#292524] font-semibold rounded-xl py-2.5 text-xs hover:bg-[#F3EDE2] transition-all"
              >
                Back to Exam
              </button>
              <button
                onClick={handleSubmitExam}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-[#9A3412] to-[#C2410C] text-white font-bold rounded-xl py-2.5 text-xs hover:from-[#7C2D12] hover:to-[#9A3412] transition-all shadow-xs"
              >
                {loading ? "Submitting..." : "Yes, Submit Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ IN-EXAM INTERACTIVE CALCULATOR ═══════ */}
      <ExamCalculator
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
      />
    </div>
  );
}

"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useExamStore } from "../../../../store/examStore";
import { apiFetch } from "../../../../lib/api";
import { useToast } from "../../../../components/Toast";
import {
  ShieldAlert, ShieldCheck, Clock, Timer, Calculator, HelpCircle,
  CheckCircle2, AlertTriangle, ArrowRight, BookOpen, CheckSquare,
  Maximize2, Flag, ChevronLeft, ChevronRight, FileText, Sparkles,
  Info, Lock, Laptop, Wifi, AlertCircle
} from "lucide-react";

export default function PreExamInstructionsPage() {
  const params = useParams();
  const router = useRouter();
  const examCode = params.exam_code as string;
  const { showToast } = useToast();
  const examStore = useExamStore();

  const [loadingInfo, setLoadingInfo] = useState(true);
  const [examMeta, setExamMeta] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Pre-flight checklist states
  const [checklist, setChecklist] = useState({
    instructions: false,
    colorGuide: false,
    navigation: false,
    calculator: false,
    timer: false,
    proctoring: false,
    internet: false,
  });

  // Master acknowledgement checkbox
  const [masterAcknowledged, setMasterAcknowledged] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Interactive mock palette demo selection
  const [demoActiveIdx, setDemoActiveIdx] = useState(2);
  const [demoAnswers, setDemoAnswers] = useState<Record<number, boolean>>({ 0: true, 1: true });
  const [demoFlags, setDemoFlags] = useState<Record<number, boolean>>({ 1: true, 4: true });

  useEffect(() => {
    const fetchInstructionsInfo = async () => {
      setLoadingInfo(true);
      setError(null);
      try {
        const token = examStore.sessionToken || (typeof window !== "undefined" ? sessionStorage.getItem(`exam_token_${examCode}`) : null);
        if (!token) {
          // No active session token -> return to login
          router.replace(`/exam/${examCode}`);
          return;
        }

        const res = await apiFetch(`/attempts/instructions-info?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail || "Failed to load examination instructions.");
        }

        // If candidate has already started, resume into active exam immediately
        if (data.is_started) {
          router.replace(`/exam/${examCode}`);
          return;
        }

        setExamMeta(data);
      } catch (err: any) {
        setError(err.message || "Failed to load examination data.");
        showToast(err.message || "Could not retrieve examination details.", "error");
      } finally {
        setLoadingInfo(false);
      }
    };

    fetchInstructionsInfo();
  }, [examCode, examStore.sessionToken, router]);

  const handleStartExam = async () => {
    if (!masterAcknowledged || isStarting) return;

    setIsStarting(true);
    setError(null);

    try {
      const token = examStore.sessionToken || (typeof window !== "undefined" ? sessionStorage.getItem(`exam_token_${examCode}`) : null);
      if (!token) {
        router.replace(`/exam/${examCode}`);
        return;
      }

      const res = await apiFetch(`/attempts/start-exam?token=${token}`, {
        method: "POST",
        body: JSON.stringify({ acknowledged: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to start examination.");
      }

      showToast("Examination officially started. Timer running.", "success");

      // Navigate to active examination
      router.push(`/exam/${examCode}`);
    } catch (err: any) {
      setError(err.message || "Could not start examination. Please try again.");
      showToast(err.message || "Start request failed.", "error");
      setIsStarting(false);
    }
  };

  const handleChecklistToggle = (key: keyof typeof checklist) => {
    setChecklist((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const allChecked = Object.values(next).every(Boolean);
      if (allChecked) setMasterAcknowledged(true);
      return next;
    });
  };

  const handleMasterToggle = () => {
    const nextVal = !masterAcknowledged;
    setMasterAcknowledged(nextVal);
    if (nextVal) {
      setChecklist({
        instructions: true,
        colorGuide: true,
        navigation: true,
        calculator: true,
        timer: true,
        proctoring: true,
        internet: true,
      });
    }
  };

  if (loadingInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F4EF] dark:bg-[#0F0E0D] p-4">
        <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 sm:p-8 max-w-md w-full text-center space-y-4 shadow-xl">
          <div className="w-8 h-8 rounded-full border-3 border-[#C84B18] border-t-transparent animate-spin mx-auto" />
          <h2 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">
            Preparing Examination Portal
          </h2>
          <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
            Validating candidate access credentials and loading official examination instructions...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4EF] dark:bg-[#0F0E0D] text-[#242321] dark:text-[#F5F5F4] pb-24 font-sans">
      {/* ══════════════ PORTAL TOP HUD HEADER ══════════════ */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#171615]/95 backdrop-blur-md border-b border-[#E5E0D8] dark:border-[#292524] shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] flex items-center justify-center font-bold font-serif text-base border border-[#C84B18]/20">
              EQ
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#C84B18] uppercase tracking-wider">
                EduQuizX Candidate Examination Portal
              </div>
              <h1 className="text-sm sm:text-base font-bold text-[#242321] dark:text-[#F5F5F4] truncate">
                {examMeta?.exam_name || "Assessment"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-[11px] font-bold text-[#242321] dark:text-[#F5F5F4]">
                {examMeta?.candidate_name}
              </span>
              <span className="text-[10px] text-[#716D67] dark:text-[#A8A29E]">
                Roll: {examMeta?.roll_number}
              </span>
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-[11px] font-bold flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>Not Started</span>
            </div>
          </div>
        </div>
      </header>

      {/* ══════════════ MAIN CONTENT CONTAINER ══════════════ */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6 sm:space-y-8">
        {/* Error Banner if any */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 text-rose-800 dark:text-rose-300 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-bold">Error Occurred</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* ══════ CANDIDATE & ASSESSMENT IDENTITY CARD ══════ */}
        <section className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E0D8] dark:border-[#292524] pb-4">
            <div>
              <span className="text-[10px] font-bold text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">
                Exam Code: {examMeta?.exam_code}
              </span>
              <h2 className="text-lg sm:text-xl font-black text-[#242321] dark:text-[#F5F5F4]">
                {examMeta?.exam_name}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] text-xs">
                <span className="text-[#716D67] dark:text-[#A8A29E]">Candidate: </span>
                <b className="text-[#242321] dark:text-[#F5F5F4]">{examMeta?.candidate_name}</b>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] text-xs">
                <span className="text-[#716D67] dark:text-[#A8A29E]">Roll No: </span>
                <b className="text-[#242321] dark:text-[#F5F5F4]">{examMeta?.roll_number}</b>
              </div>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524]">
              <div className="text-lg sm:text-xl font-black text-[#242321] dark:text-[#F5F5F4]">
                {examMeta?.duration_minutes || 30} mins
              </div>
              <div className="text-[10px] font-bold text-[#716D67] uppercase">Allotted Duration</div>
            </div>
            <div className="p-3 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524]">
              <div className="text-lg sm:text-xl font-black text-[#242321] dark:text-[#F5F5F4]">
                {examMeta?.total_questions || 0}
              </div>
              <div className="text-[10px] font-bold text-[#716D67] uppercase">Total Questions</div>
            </div>
            <div className="p-3 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524]">
              <div className="text-lg sm:text-xl font-black text-[#242321] dark:text-[#F5F5F4]">
                {examMeta?.total_marks || 0}
              </div>
              <div className="text-[10px] font-bold text-[#716D67] uppercase">Maximum Marks</div>
            </div>
            <div className="p-3 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524]">
              <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                {examMeta?.calculator_enabled ? "Available" : "Disabled"}
              </div>
              <div className="text-[10px] font-bold text-[#716D67] uppercase">On-Screen Calculator</div>
            </div>
          </div>
        </section>

        {/* ══════ SECTION 1: GENERAL EXAMINATION INSTRUCTIONS ══════ */}
        <section className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
            <BookOpen className="h-5 w-5 text-[#C84B18]" />
            <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">
              Section 1 — General Examination Instructions
            </h3>
          </div>

          <ol className="list-decimal list-inside space-y-2.5 text-xs sm:text-sm text-[#44403C] dark:text-[#D6D3D1] leading-relaxed">
            <li>Read all instructions thoroughly before commencing the examination.</li>
            <li>The official examination timer begins only when you click <b>"START EXAMINATION"</b> below.</li>
            <li>The examination time is controlled strictly by the authoritative server clock, not your local device time.</li>
            <li>All your selections and typed answers are automatically saved to the secure cloud buffer.</li>
            <li>Do not unnecessarily refresh the page, close the browser window, or navigate away from the test tab.</li>
            <li>Ensure a continuous, stable internet connection throughout the test duration.</li>
            <li>Do not share your timed access credentials or passcode with anyone else.</li>
            <li>Only resources explicitly permitted by the instructor may be used during the test.</li>
            <li>Do not attempt to open developer tools, inspect elements, or bypass monitoring controls.</li>
            <li>You can review and modify your answers at any point before final submission.</li>
            <li>The examination will automatically submit when the allotted examination duration expires.</li>
            <li>Once final submission is confirmed, your responses are permanently recorded and cannot be revised.</li>
          </ol>
        </section>

        {/* ══════ SECTION 2: HOW THE EXAMINATION WORKS (VISUAL CBT GUIDE) ══════ */}
        <section className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
            <Laptop className="h-5 w-5 text-[#C84B18]" />
            <div>
              <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">
                Section 2 — How the Examination Interface Works
              </h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                Familiarize yourself with the layout and controls of the actual EduQuizX testing window.
              </p>
            </div>
          </div>

          {/* Visual Mockup Container */}
          <div className="border border-[#E5E0D8] dark:border-[#292524] rounded-xl overflow-hidden bg-[#F7F4EF] dark:bg-[#141312]">
            {/* Mock Header HUD */}
            <div className="bg-white dark:bg-[#171615] border-b border-[#E5E0D8] dark:border-[#292524] px-4 py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#C84B18]">EQ Mock Assessment</span>
                <span className="text-[#716D67] hidden sm:inline">• Candidate: {examMeta?.candidate_name}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-2.5 py-0.5 rounded-lg border border-[#E5E0D8] dark:border-[#292524] font-mono font-bold text-xs flex items-center gap-1.5 bg-[#F7F4EF] dark:bg-[#141312]">
                  <Timer className="h-3.5 w-3.5 text-[#C84B18]" />
                  <span>58:45</span>
                </div>
                <div className="px-2 py-0.5 rounded-lg border border-[#E5E0D8] dark:border-[#292524] text-[11px] font-semibold flex items-center gap-1 bg-white dark:bg-[#171615]">
                  <Calculator className="h-3 w-3 text-[#716D67]" />
                  <span className="hidden sm:inline">Calculator</span>
                </div>
              </div>
            </div>

            {/* Mock Question Area */}
            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-2">
                <span className="font-bold text-xs text-[#716D67] uppercase">Question 3 of {examMeta?.total_questions || 10}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-[#716D67] border border-dashed border-[#E5E0D8] dark:border-[#292524] px-2 py-0.5 rounded">
                    Clear
                  </span>
                  <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/40 border border-purple-300 px-2 py-0.5 rounded flex items-center gap-1">
                    <Flag className="h-3 w-3" />
                    <span>Mark for Review</span>
                  </span>
                </div>
              </div>

              {/* Sample Question Stem */}
              <div className="text-sm font-semibold text-[#242321] dark:text-[#F5F5F4]">
                Which data structure organizes elements in a First-In-First-Out (FIFO) sequence?
              </div>

              {/* Mock Options */}
              <div className="space-y-2">
                {[
                  { key: "A", text: "Stack (LIFO)" },
                  { key: "B", text: "Queue (FIFO)", selected: true },
                  { key: "C", text: "Binary Search Tree" },
                  { key: "D", text: "Hash Table" },
                ].map((opt) => (
                  <div
                    key={opt.key}
                    className={`p-2.5 rounded-xl border flex items-center gap-3 text-xs ${
                      opt.selected
                        ? "bg-[#C84B18]/5 border-[#C84B18] text-[#242321] dark:text-[#F5F5F4] font-semibold"
                        : "bg-white dark:bg-[#171615] border-[#E5E0D8] dark:border-[#292524] text-[#716D67]"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 border ${
                        opt.selected
                          ? "bg-[#C84B18] text-white border-[#C84B18]"
                          : "border-[#E5E0D8] dark:border-[#292524]"
                      }`}
                    >
                      {opt.key}
                    </div>
                    <span>{opt.text}</span>
                  </div>
                ))}
              </div>

              {/* Mock Bottom Navigation */}
              <div className="flex items-center justify-between border-t border-[#E5E0D8] dark:border-[#292524] pt-3 text-xs">
                <div className="px-3 py-1.5 rounded-lg border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] font-semibold flex items-center gap-1">
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </div>
                <span className="text-[11px] font-semibold text-[#716D67]">Clear Selection</span>
                <div className="px-4 py-1.5 rounded-lg bg-[#C84B18] text-white font-bold flex items-center gap-1">
                  <span>Next Question</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════ SECTION 3: QUESTION STATUS / COLOR GUIDE ══════ */}
        <section className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
            <CheckCircle2 className="h-5 w-5 text-[#C84B18]" />
            <div>
              <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">
                Section 3 — Question Status / Color Guide
              </h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                The question palette on the right side of the screen uses color-coded indicators to reflect your progress.
              </p>
            </div>
          </div>

          {/* Color Legend Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs flex items-center justify-center">
                  1
                </div>
                <span className="font-bold text-xs text-emerald-900 dark:text-emerald-300">
                  Answered / Solved
                </span>
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-400">
                You have selected and saved an answer for this question.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/40 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="relative w-6 h-6 rounded-lg bg-purple-100 border border-purple-300 text-purple-900 font-bold text-xs flex items-center justify-center">
                  2
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-purple-600" />
                </div>
                <span className="font-bold text-xs text-purple-900 dark:text-purple-300">
                  Marked for Review
                </span>
              </div>
              <p className="text-xs text-purple-800 dark:text-purple-400">
                You have flagged this question so you can quickly return to it later.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border bg-[#F7F4EF] dark:bg-[#141312] border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#F7F4EF] dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] font-bold text-xs flex items-center justify-center">
                  3
                </div>
                <span className="font-bold text-xs text-[#716D67] dark:text-[#A8A29E]">
                  Unsolved / Not Answered
                </span>
              </div>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                This question has not yet been answered.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border bg-white dark:bg-[#171615] border-[#C84B18] space-y-1.5 ring-2 ring-[#C84B18]/20">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg ring-2 ring-[#C84B18] border border-[#C84B18] text-[#C84B18] font-bold text-xs flex items-center justify-center">
                  4
                </div>
                <span className="font-bold text-xs text-[#C84B18]">
                  Current Active Question
                </span>
              </div>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                The question currently open and displayed on your screen.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border bg-purple-50/50 dark:bg-purple-950/10 border-purple-200/60 space-y-1.5 sm:col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2">
                <div className="relative w-6 h-6 rounded-lg bg-purple-100 border border-purple-300 text-purple-900 font-bold text-xs flex items-center justify-center">
                  5
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-purple-600" />
                </div>
                <span className="font-bold text-xs text-purple-900 dark:text-purple-300">
                  Answered & Marked for Review
                </span>
              </div>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                An answer is saved, but you have also marked it for a second look before submitting.
              </p>
            </div>
          </div>

          {/* Interactive Non-functional Demonstration Palette */}
          <div className="p-4 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#716D67] uppercase tracking-wider">
                Demonstration Palette Preview
              </span>
              <span className="text-[11px] text-[#716D67]">Click pills to preview status switching</span>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num, i) => {
                const isCur = i === demoActiveIdx;
                const isAns = demoAnswers[i];
                const isFlg = demoFlags[i];

                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setDemoActiveIdx(i);
                      // Toggle answer on click for interactive demo feel
                      setDemoAnswers((prev) => ({ ...prev, [i]: !prev[i] }));
                    }}
                    className={`relative h-10 rounded-xl text-xs font-bold transition-all flex items-center justify-center border cursor-pointer ${
                      isCur
                        ? "ring-2 ring-[#C84B18] border-[#C84B18] scale-105 z-10 shadow-xs"
                        : "hover:scale-102"
                    } ${
                      isFlg
                        ? "bg-purple-100 dark:bg-purple-950/40 border-purple-300 text-purple-900 dark:text-purple-300"
                        : isAns
                        ? "bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-300"
                        : "bg-white dark:bg-[#1D1B19] border-[#E5E0D8] text-[#716D67]"
                    }`}
                  >
                    <span>{num}</span>
                    {isFlg && <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-purple-600" />}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-[#716D67] text-center">
              Your actual exam question palette lets you jump directly to any question at any time.
            </p>
          </div>
        </section>

        {/* ══════ SECTION 4: NAVIGATION GUIDE ══════ */}
        <section className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
            <ChevronRight className="h-5 w-5 text-[#C84B18]" />
            <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">
              Section 4 — Navigation & Action Controls
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-[#E5E0D8] dark:border-[#292524] bg-[#F7F4EF]/50 dark:bg-[#141312] space-y-1">
              <b className="text-[#C84B18]">Next Question / Save & Next</b>
              <p className="text-[#716D67] dark:text-[#A8A29E]">
                Saves your selected response and advances to the next question in numerical sequence.
              </p>
            </div>
            <div className="p-3 rounded-xl border border-[#E5E0D8] dark:border-[#292524] bg-[#F7F4EF]/50 dark:bg-[#141312] space-y-1">
              <b className="text-[#242321] dark:text-[#F5F5F4]">Previous Question</b>
              <p className="text-[#716D67] dark:text-[#A8A29E]">
                Returns to the immediately preceding question to review or edit your choice.
              </p>
            </div>
            <div className="p-3 rounded-xl border border-[#E5E0D8] dark:border-[#292524] bg-[#F7F4EF]/50 dark:bg-[#141312] space-y-1">
              <b className="text-rose-600 dark:text-rose-400">Clear Selection</b>
              <p className="text-[#716D67] dark:text-[#A8A29E]">
                Clears the currently selected answer option for the open question.
              </p>
            </div>
            <div className="p-3 rounded-xl border border-[#E5E0D8] dark:border-[#292524] bg-[#F7F4EF]/50 dark:bg-[#141312] space-y-1">
              <b className="text-purple-600 dark:text-purple-400">Mark for Review</b>
              <p className="text-[#716D67] dark:text-[#A8A29E]">
                Flags the question with a purple badge on the palette so you can find it quickly later.
              </p>
            </div>
            <div className="p-3 rounded-xl border border-[#E5E0D8] dark:border-[#292524] bg-[#F7F4EF]/50 dark:bg-[#141312] space-y-1">
              <b className="text-[#242321] dark:text-[#F5F5F4]">Question Palette Grid</b>
              <p className="text-[#716D67] dark:text-[#A8A29E]">
                Click any numbered button on the right palette to jump straight to that question.
              </p>
            </div>
            <div className="p-3 rounded-xl border border-[#E5E0D8] dark:border-[#292524] bg-[#F7F4EF]/50 dark:bg-[#141312] space-y-1">
              <b className="text-[#C84B18]">Review & Submit</b>
              <p className="text-[#716D67] dark:text-[#A8A29E]">
                Opens the final confirmation modal summarizing solved, review, and skipped questions before final exit.
              </p>
            </div>
          </div>
        </section>

        {/* ══════ SECTION 5: ON-SCREEN CALCULATOR ══════ */}
        <section className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
            <Calculator className="h-5 w-5 text-[#C84B18]" />
            <div className="flex-1 flex items-center justify-between">
              <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">
                Section 5 — On-Screen Scientific Calculator
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  examMeta?.calculator_enabled
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "bg-stone-100 text-stone-600 border-stone-300 dark:bg-stone-900 dark:text-stone-400"
                }`}
              >
                {examMeta?.calculator_enabled ? "🧮 Calculator: AVAILABLE" : "🧮 Calculator: NOT AVAILABLE"}
              </span>
            </div>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-[#44403C] dark:text-[#D6D3D1] leading-relaxed">
            <p>
              An integrated, draggable scientific calculator is provided in the top-right header of your examination HUD.
            </p>

            <div className="p-3.5 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-2">
              <b className="text-xs text-[#242321] dark:text-[#F5F5F4]">How to use the calculator:</b>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-[#716D67] dark:text-[#A8A29E]">
                <li><b>Opening:</b> Click the <b>Calculator</b> button in the top-right corner of the top header.</li>
                <li><b>Draggable:</b> Click and drag the calculator header to move it anywhere across your screen.</li>
                <li><b>Non-Disruptive:</b> Opening or using the calculator does NOT interrupt your answer or reset your selection.</li>
                <li><b>Keyboard Shortcuts:</b> You can type numbers, standard operators (+, -, *, /), Enter for equals, and Escape to close.</li>
                <li><b>Functions:</b> Supports standard arithmetic, square roots, trigonometric functions, exponents, logarithms, and parentheses.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ══════ SECTION 6: TIMER & AUTOSAVE ══════ */}
        <section className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
            <Timer className="h-5 w-5 text-[#C84B18]" />
            <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">
              Section 6 — Examination Timer & Automatic Saving
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl border border-[#E5E0D8] dark:border-[#292524] bg-[#F7F4EF]/50 dark:bg-[#141312] space-y-2">
              <b className="text-sm text-[#242321] dark:text-[#F5F5F4] flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[#C84B18]" />
                Server-Controlled Countdown
              </b>
              <p className="text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                The top-center HUD continuously displays your exact remaining time. When time drops below 5 minutes, the timer highlights in amber; under 2 minutes, it turns pulsing red. The timer is locked to the server and cannot be slowed down by device adjustments.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-[#E5E0D8] dark:border-[#292524] bg-[#F7F4EF]/50 dark:bg-[#141312] space-y-2">
              <b className="text-sm text-[#242321] dark:text-[#F5F5F4] flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                Automatic Response Syncing
              </b>
              <p className="text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                Every option you click or text you type is automatically synced. The HUD Cloud status indicates <b>Synced</b> (green cloud), <b>Saving...</b> (spinner), or <b>Local Buffer</b> (amber offline protection). If a temporary network glitch occurs, answers are buffered locally and retried automatically.
              </p>
            </div>
          </div>
        </section>

        {/* ══════ SECTION 7: PROCTORING & SECURITY ══════ */}
        <section className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
            <ShieldAlert className="h-5 w-5 text-rose-600" />
            <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">
              Section 7 — Examination Security & Proctoring Rules
            </h3>
          </div>

          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-2 text-xs leading-relaxed text-rose-900 dark:text-rose-200">
            <div className="font-bold text-sm flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Tab-Switch & Window Focus Policy (2-Strike Rule)
            </div>
            <p>
              This assessment enforces strict automated window proctoring:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li><b>1st Tab Switch / Window Blur:</b> A prominent warning modal appears on your screen, and 1 violation strike is recorded on your proctoring log.</li>
              <li><b>2nd Tab Switch:</b> Your examination will be <b>IMMEDIATELY AUTO-SUBMITTED</b> by the server for violation of examination conduct rules.</li>
              <li>Do NOT switch tabs, minimize the browser, open secondary windows, or use split-screen mode during the exam.</li>
              <li>Stay in Fullscreen mode throughout the test for optimal focus.</li>
            </ul>
          </div>
        </section>

        {/* ══════ SECTION 8: TECHNICAL REQUIREMENTS ══════ */}
        <section className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-5 sm:p-6 shadow-xs space-y-3 text-xs text-[#716D67] dark:text-[#A8A29E]">
          <div className="flex items-center gap-2.5 border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
            <Wifi className="h-5 w-5 text-[#C84B18]" />
            <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">
              Section 8 — Technical Checklist
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl border border-[#E5E0D8] dark:border-[#292524] space-y-1">
              <b className="text-[#242321] dark:text-[#F5F5F4]">Supported Browser</b>
              <p>Chrome, Edge, Firefox, or Safari (latest versions recommended).</p>
            </div>
            <div className="p-3 rounded-xl border border-[#E5E0D8] dark:border-[#292524] space-y-1">
              <b className="text-[#242321] dark:text-[#F5F5F4]">Stable Connection</b>
              <p>Broadband Wi-Fi or reliable 4G/5G mobile hotspot.</p>
            </div>
            <div className="p-3 rounded-xl border border-[#E5E0D8] dark:border-[#292524] space-y-1">
              <b className="text-[#242321] dark:text-[#F5F5F4]">Device Battery</b>
              <p>Keep your laptop or tablet connected to a power outlet.</p>
            </div>
          </div>
        </section>

        {/* ══════ SECTION 9: PRE-FLIGHT CHECKLIST & ACKNOWLEDGEMENT ══════ */}
        <section className="bg-white dark:bg-[#171615] border-2 border-[#C84B18]/30 dark:border-[#C84B18]/40 rounded-2xl p-5 sm:p-6 shadow-md space-y-5">
          <div className="flex items-center gap-2.5 border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
            <CheckSquare className="h-5 w-5 text-[#C84B18]" />
            <div>
              <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">
                Section 9 — Pre-Flight Confirmation & Acknowledgement
              </h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                Review the items below and provide final confirmation to enable the examination launch button.
              </p>
            </div>
          </div>

          {/* Checklist Items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {[
              { id: "instructions", label: "I have read and understand all general examination instructions." },
              { id: "colorGuide", label: "I understand the question palette status indicators and colors." },
              { id: "navigation", label: "I understand how to navigate, clear, and save answers." },
              { id: "calculator", label: "I understand the on-screen calculator location and functionality." },
              { id: "timer", label: "I understand the examination timer and auto-submission rules." },
              { id: "proctoring", label: "I understand the 2-strike tab-switch proctoring policy." },
              { id: "internet", label: "My device is charged and connected to a stable internet connection." },
            ].map((item) => (
              <label
                key={item.id}
                className="flex items-start gap-2.5 p-2.5 rounded-xl border border-[#E5E0D8] dark:border-[#292524] bg-[#F7F4EF]/50 dark:bg-[#141312] hover:bg-[#F7F4EF] cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checklist[item.id as keyof typeof checklist]}
                  onChange={() => handleChecklistToggle(item.id as keyof typeof checklist)}
                  className="mt-0.5 h-4 w-4 rounded text-[#C84B18] focus:ring-[#C84B18] border-gray-300"
                />
                <span className="text-[#44403C] dark:text-[#D6D3D1] font-medium leading-tight">
                  {item.label}
                </span>
              </label>
            ))}
          </div>

          {/* Master Acknowledgement Banner */}
          <div className="p-4 rounded-xl bg-[#C84B18]/10 dark:bg-[#C84B18]/15 border border-[#C84B18]/30 flex items-start gap-3">
            <input
              type="checkbox"
              id="master-ack"
              checked={masterAcknowledged}
              onChange={handleMasterToggle}
              className="mt-1 h-5 w-5 rounded text-[#C84B18] focus:ring-[#C84B18] border-gray-400 cursor-pointer"
            />
            <label htmlFor="master-ack" className="text-xs sm:text-sm font-bold text-[#242321] dark:text-[#F5F5F4] cursor-pointer leading-snug">
              I have read, understood, and agreed to all the examination rules, proctoring guidelines, and interface instructions. I am ready to begin the examination.
            </label>
          </div>

          {/* Start Examination Button */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
              {masterAcknowledged
                ? "Acknowledgement confirmed. Click below to begin your official timed session."
                : "Please tick the master acknowledgement above to enable the Start Examination button."}
            </p>

            <button
              type="button"
              disabled={!masterAcknowledged || isStarting}
              onClick={handleStartExam}
              className={`px-8 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shrink-0 cursor-pointer ${
                masterAcknowledged && !isStarting
                  ? "bg-[#C84B18] hover:bg-[#A8380D] text-white hover:shadow-lg active:scale-98"
                  : "bg-gray-300 dark:bg-stone-800 text-gray-500 dark:text-stone-500 cursor-not-allowed shadow-none"
              }`}
            >
              {isStarting ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Starting Official Examination...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>START EXAMINATION</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

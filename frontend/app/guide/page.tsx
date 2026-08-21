"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  School, 
  GraduationCap, 
  BookOpen, 
  Sparkles, 
  ShieldCheck, 
  BarChart3, 
  ArrowRight, 
  CheckCircle2, 
  KeyRound, 
  Layers, 
  Lock, 
  Eye, 
  Clock, 
  Award, 
  Zap, 
  FileSpreadsheet, 
  Check, 
  HelpCircle,
  ShieldAlert,
  Play,
  Copy,
  ChevronDown
} from "lucide-react";

export default function GuidePage() {
  const router = useRouter();
  const [copiedCred, setCopiedCred] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCred(label);
    setTimeout(() => setCopiedCred(null), 2000);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F4EF] dark:bg-[#0F0E0D] text-[#242321] dark:text-[#F5F5F4] transition-colors duration-200 selection:bg-[#C84B18]/20">
      
      {/* ═══════ TOP NAVIGATION BAR ═══════ */}
      <header className="sticky top-0 z-40 bg-[#F7F4EF]/90 dark:bg-[#0F0E0D]/90 backdrop-blur-md border-b border-[#E5E0D8] dark:border-[#292524] px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#C84B18] dark:bg-[#EA580C] text-white shadow-sm">
            <School className="h-5 w-5" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-[#242321] dark:text-[#F5F5F4]">EduQuizX</span>
            <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C]">
              Platform Architecture & User Manual
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="btn-primary flex items-center gap-2 text-xs py-2 px-4 shadow-sm cursor-pointer"
          >
            <span>Select Workspace Mode</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ═══════ HERO SECTION ═══════ */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pt-14 pb-8 text-center space-y-4 relative">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#C84B18]/10 dark:bg-[#EA580C]/15 border border-[#C84B18]/20 text-[#C84B18] dark:text-[#EA580C] text-xs font-bold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Interactive End-to-End Walkthrough</span>
        </div>

        <h1 className="text-3xl md:text-5xl font-black tracking-tight max-w-3xl mx-auto text-[#242321] dark:text-[#F5F5F4] leading-tight">
          How to Use <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C84B18] via-amber-600 to-[#EA580C]">EduQuizX</span>
        </h1>

        <p className="text-sm md:text-base text-[#716D67] dark:text-[#A8A29E] max-w-2xl mx-auto leading-relaxed">
          A continuous reference guide covering AI assessment generation, candidate student directories, anti-cheat live proctor telemetry, and student response booklets.
        </p>

        {/* Action CTAs */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-[#C84B18] hover:bg-[#B33E0F] dark:bg-[#EA580C] dark:hover:bg-[#C2410C] text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-[#C84B18]/20 flex items-center gap-2 cursor-pointer"
          >
            <span>Select Workspace Mode</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            onClick={() => scrollToSection("demo-credentials")}
            className="px-5 py-3 bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] hover:bg-[#F0ECE4]/60 dark:hover:bg-[#292524] text-[#242321] dark:text-[#F5F5F4] font-semibold rounded-xl text-xs transition-all flex items-center gap-2 shadow-2xs cursor-pointer"
          >
            <KeyRound className="h-3.5 w-3.5 text-[#C84B18]" />
            <span>View Demo Credentials</span>
          </button>
        </div>
      </section>

      {/* ═══════ STICKY QUICK-NAVIGATION ANCHOR BAR ═══════ */}
      <div className="sticky top-[57px] z-30 bg-[#F7F4EF]/95 dark:bg-[#0F0E0D]/95 backdrop-blur-md border-y border-[#E5E0D8]/80 dark:border-[#292524]/80 py-2.5 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-2 flex-wrap text-xs">
          <button
            onClick={() => scrollToSection("creator-workflow")}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#171615] hover:bg-[#F0ECE4] dark:hover:bg-[#292524] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#C84B18]" />
            <span>1. Teacher Creator</span>
          </button>

          <button
            onClick={() => scrollToSection("student-workflow")}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#171615] hover:bg-[#F0ECE4] dark:hover:bg-[#292524] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
            <span>2. Student Portal</span>
          </button>

          <button
            onClick={() => scrollToSection("security-proctoring")}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#171615] hover:bg-[#F0ECE4] dark:hover:bg-[#292524] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>3. Anti-Cheat & Live Telemetry</span>
          </button>

          <button
            onClick={() => scrollToSection("analytics-gradebook")}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#171615] hover:bg-[#F0ECE4] dark:hover:bg-[#292524] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
            <span>4. Gradebook & PDFs</span>
          </button>

          <button
            onClick={() => scrollToSection("demo-credentials")}
            className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>5. Demo Credentials</span>
          </button>
        </div>
      </div>

      {/* ═══════ CONTINUOUS SCROLL-DOWN CONTENT ═══════ */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-10 space-y-16">

        {/* ─── SECTION 1: TEACHER & CREATOR WORKFLOW ─── */}
        <section id="creator-workflow" className="scroll-mt-28 space-y-6">
          <div className="flex items-center gap-3 border-b border-[#E5E0D8] dark:border-[#292524] pb-4">
            <div className="p-2.5 rounded-xl bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] border border-[#C84B18]/20">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#C84B18] dark:text-[#EA580C]">Section 01</span>
                <span className="text-xs text-[#716D67]">•</span>
                <span className="text-xs text-[#716D67]">SaaS Creator Guide</span>
              </div>
              <h2 className="text-xl font-bold text-[#242321] dark:text-[#F5F5F4]">Assessment Creator & Knowledge Base Workflow</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 space-y-3.5 shadow-sm hover:border-[#C84B18]/40 transition-colors">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-[#C84B18]/10 text-[#C84B18] font-bold flex items-center justify-center text-xs">
                  01
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">Knowledge Base</span>
              </div>
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">Upload Course Documents to Vector KB</h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                Navigate to the <b>Knowledge Base</b> tab. Upload lecture slides, PDFs, or textbooks. The system automatically chunks the text and indexes vector embeddings using Gemini AI.
              </p>
              <div className="p-3 bg-[#F7F4EF] dark:bg-[#141312] rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-[11px] text-[#716D67]">
                Supported formats: PDF, DOCX, TXT, PPTX (Max 25MB per document).
              </div>
            </div>

            <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 space-y-3.5 shadow-sm hover:border-[#C84B18]/40 transition-colors">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-[#C84B18]/10 text-[#C84B18] font-bold flex items-center justify-center text-xs">
                  02
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">Assessment Stepper</span>
              </div>
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">AI RAG Assessment Stepper Wizard</h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                Use the 4-step <b>Assessment Stepper Wizard</b> to select your knowledge base context, cognitive targets, question distributions, and target <b>Student Directories</b>.
              </p>
              <div className="p-3 bg-[#F7F4EF] dark:bg-[#141312] rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-[11px] text-[#716D67]">
                Create new Student Directories on the fly in Step 4 before publishing.
              </div>
            </div>

            <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 space-y-3.5 shadow-sm hover:border-[#C84B18]/40 transition-colors">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-[#C84B18]/10 text-[#C84B18] font-bold flex items-center justify-center text-xs">
                  03
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">Workspace Hub</span>
              </div>
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">Assessments Table & Schedule Controls</h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                Monitor active and scheduled exams from the high-density <b>Assessments Table</b>. Launch Live Proctoring streams, export candidate credentials, or end tests early.
              </p>
              <div className="p-3 bg-[#F7F4EF] dark:bg-[#141312] rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-[11px] text-[#716D67]">
                Candidates receive automated email notifications with unique test links.
              </div>
            </div>

            <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 space-y-3.5 shadow-sm hover:border-[#C84B18]/40 transition-colors">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-[#C84B18]/10 text-[#C84B18] font-bold flex items-center justify-center text-xs">
                  04
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">Question Studio</span>
              </div>
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">Reusable Question Bank & AI Reroll</h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                Browse approved questions filtered by topic and difficulty. Reroll individual questions using natural language teacher prompts before publishing.
              </p>
              <div className="p-3 bg-[#F7F4EF] dark:bg-[#141312] rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-[11px] text-[#716D67]">
                Full teacher control over manual mark overrides and grade releases.
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 2: STUDENT PORTAL WORKFLOW ─── */}
        <section id="student-workflow" className="scroll-mt-28 space-y-6">
          <div className="flex items-center gap-3 border-b border-[#E5E0D8] dark:border-[#292524] pb-4">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-500/20">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Section 02</span>
                <span className="text-xs text-[#716D67]">•</span>
                <span className="text-xs text-[#716D67]">Candidate Experience</span>
              </div>
              <h2 className="text-xl font-bold text-[#242321] dark:text-[#F5F5F4]">Student Portal & Anti-Cheat Examination Journey</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 space-y-3.5 shadow-sm hover:border-emerald-500/40 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center text-xs">
                01
              </div>
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">Access Portal or Fast Exam Gateway</h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                Log into the <b>Student Portal</b> with your credentials or paste an Exam Code directly into the fast access gateway on the login screen.
              </p>
            </div>

            <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 space-y-3.5 shadow-sm hover:border-emerald-500/40 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center text-xs">
                02
              </div>
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">Complete Anti-Cheat Test Session</h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                Enter your assigned session username/password. Take the test within the countdown timer while anti-cheat telemetry safeguards exam integrity.
              </p>
            </div>

            <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 space-y-3.5 shadow-sm hover:border-emerald-500/40 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center text-xs">
                03
              </div>
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">Inspect Official Response Booklet</h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                Once grades are released by your instructor, open your printable Official Response Booklet to review selected answers, correct solutions, and AI feedback.
              </p>
            </div>

            <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 space-y-3.5 shadow-sm hover:border-emerald-500/40 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center text-xs">
                04
              </div>
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">Track Learning Trends & Mastery</h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                Check the <b>Learning Trends & Mastery</b> tab in your portal for Recharts performance graphs, topic radar breakdown, and weak-topic recommendations.
              </p>
            </div>
          </div>
        </section>

        {/* ─── SECTION 3: PROCTORING & SECURITY ─── */}
        <section id="security-proctoring" className="scroll-mt-28 space-y-6">
          <div className="flex items-center gap-3 border-b border-[#E5E0D8] dark:border-[#292524] pb-4">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 border border-rose-500/20">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Section 03</span>
                <span className="text-xs text-[#716D67]">•</span>
                <span className="text-xs text-[#716D67]">Aegis Telemetry</span>
              </div>
              <h2 className="text-xl font-bold text-[#242321] dark:text-[#F5F5F4]">Anti-Cheat Guard & Live Proctor Command Center</h2>
            </div>
          </div>

          <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
            <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
              The Aegis security suite runs real-time browser heuristics, detecting and streaming anomaly events directly to the teacher's proctoring dashboard.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                <div className="text-xs font-bold text-[#C84B18] dark:text-[#EA580C]">Tab Focus Tracking</div>
                <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">Logs tab switches, window minimization, and background application focus losses with timestamps.</p>
              </div>

              <div className="p-4 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                <div className="text-xs font-bold text-[#C84B18] dark:text-[#EA580C]">Clipboard & DevTools Guard</div>
                <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">Restricts copy-paste events on question prompts and prevents unauthorized browser inspector inspection.</p>
              </div>

              <div className="p-4 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                <div className="text-xs font-bold text-[#C84B18] dark:text-[#EA580C]">WebSockets Live Alerts</div>
                <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">Broadcasts real-time violation alerts directly into the teacher's Live Proctor Command Center.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 4: ANALYTICS & GRADEBOOK ─── */}
        <section id="analytics-gradebook" className="scroll-mt-28 space-y-6">
          <div className="flex items-center gap-3 border-b border-[#E5E0D8] dark:border-[#292524] pb-4">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 border border-blue-500/20">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Section 04</span>
                <span className="text-xs text-[#716D67]">•</span>
                <span className="text-xs text-[#716D67]">Evaluation Engine</span>
              </div>
              <h2 className="text-xl font-bold text-[#242321] dark:text-[#F5F5F4]">Class-Wide Analytics, Gradebook & Response Sheets</h2>
            </div>
          </div>

          <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                <div className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4]">Context-Aware Submission Sorting</div>
                <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">Multi-candidate submissions sort Student-Wise for teachers, and Exam-Wise for individual students.</p>
              </div>

              <div className="p-4 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                <div className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4]">Printable PDF & Response Sheets</div>
                <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">Export printable question papers, answer keys, and student response booklets with one click.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 5: DEMO CREDENTIALS SANDBOX ─── */}
        <section id="demo-credentials" className="scroll-mt-28 space-y-6">
          <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E0D8] dark:border-[#292524] pb-4">
              <div>
                <h2 className="text-lg font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-[#C84B18]" />
                  <span>Demo Test Accounts</span>
                </h2>
                <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-0.5">Use these credentials to log in and test features instantly.</p>
              </div>

              <button
                onClick={() => router.push("/login")}
                className="btn-primary text-xs py-2 px-4 flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <span>Launch Login Portal</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Teacher Credential Card */}
              <div className="p-4 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#C84B18] uppercase tracking-wider">Quiz Creator Account</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#C84B18]/10 text-[#C84B18]">Teacher Role</span>
                </div>
                <div className="space-y-1 text-xs font-mono bg-white dark:bg-[#171615] p-3 rounded-lg border border-[#E5E0D8] dark:border-[#292524]">
                  <div><span className="text-[#716D67]">Email:</span> teacher@aegeus.edu</div>
                  <div><span className="text-[#716D67]">Password:</span> securepassword</div>
                </div>
                <button
                  onClick={() => copyToClipboard("teacher@aegeus.edu", "teacher")}
                  className="w-full py-1.5 px-3 rounded-lg border border-[#E5E0D8] dark:border-[#292524] hover:bg-white dark:hover:bg-[#171615] text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedCred === "teacher" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedCred === "teacher" ? "Copied Email!" : "Copy Teacher Email"}</span>
                </button>
              </div>

              {/* Student Credential Card */}
              <div className="p-4 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Student Portal Account</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">Student Role</span>
                </div>
                <div className="space-y-1 text-xs font-mono bg-white dark:bg-[#171615] p-3 rounded-lg border border-[#E5E0D8] dark:border-[#292524]">
                  <div><span className="text-[#716D67]">Email:</span> student@aegeus.edu</div>
                  <div><span className="text-[#716D67]">Password:</span> securepassword</div>
                </div>
                <button
                  onClick={() => copyToClipboard("student@aegeus.edu", "student")}
                  className="w-full py-1.5 px-3 rounded-lg border border-[#E5E0D8] dark:border-[#292524] hover:bg-white dark:hover:bg-[#171615] text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedCred === "student" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedCred === "student" ? "Copied Email!" : "Copy Student Email"}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-[#E5E0D8] dark:border-[#292524] py-8 text-center text-xs text-[#716D67] dark:text-[#A8A29E]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <School className="h-4 w-4 text-[#C84B18]" />
            <span className="font-bold text-[#242321] dark:text-[#F5F5F4]">EduQuizX Examination System</span>
          </div>
          <div>Secured with Aegis Multi-factor & Anti-cheat Telemetry.</div>
          <button
            onClick={() => router.push("/login")}
            className="text-[#C84B18] font-bold hover:underline cursor-pointer"
          >
            Launch Login Window &rarr;
          </button>
        </div>
      </footer>
    </div>
  );
}

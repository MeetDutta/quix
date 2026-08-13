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
  Copy
} from "lucide-react";

export default function GuidePage() {
  const router = useRouter();
  const [activeWorkflow, setActiveWorkflow] = useState<"teacher" | "student" | "proctoring" | "analytics">("teacher");
  const [copiedCred, setCopiedCred] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCred(label);
    setTimeout(() => setCopiedCred(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F7F4EF] dark:bg-[#0F0E0D] text-[#242321] dark:text-[#F5F5F4] transition-colors duration-200 selection:bg-[#C84B18]/20">
      
      {/* ═══════ TOP NAVIGATION BAR ═══════ */}
      <header className="sticky top-0 z-30 bg-[#F7F4EF]/80 dark:bg-[#0F0E0D]/80 backdrop-blur-md border-b border-[#E5E0D8] dark:border-[#292524] px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#C84B18] dark:bg-[#EA580C] text-white shadow-sm">
            <School className="h-5 w-5" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-[#242321] dark:text-[#F5F5F4]">EduQuizX</span>
            <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C]">
              System Documentation & Guide
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/login")}
            className="btn-primary flex items-center gap-2 text-xs py-2 px-4 shadow-sm cursor-pointer"
          >
            <span>Proceed to Login Portal</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ═══════ HERO SECTION ═══════ */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pt-12 pb-8 text-center space-y-4 relative">

        <h1 className="text-3xl md:text-5xl font-black tracking-tight max-w-3xl mx-auto text-[#242321] dark:text-[#F5F5F4] leading-tight">
          How to Use <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C84B18] via-amber-600 to-[#EA580C]">EduQuizX</span>
        </h1>

        <p className="text-sm md:text-base text-[#716D67] dark:text-[#A8A29E] max-w-2xl mx-auto leading-relaxed">
          Learn how to generate AI assessments from custom course documents, monitor live proctored exams with anti-cheat telemetry, and analyze topic mastery performance.
        </p>

        {/* Action CTAs */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => router.push("/login")}
            className="px-6 py-3 bg-[#C84B18] hover:bg-[#B33E0F] dark:bg-[#EA580C] dark:hover:bg-[#C2410C] text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-[#C84B18]/20 flex items-center gap-2 cursor-pointer"
          >
            <span>Go to Login Window</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <a
            href="#demo-credentials"
            className="px-5 py-3 bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] hover:bg-[#F0ECE4]/60 dark:hover:bg-[#292524] text-[#242321] dark:text-[#F5F5F4] font-semibold rounded-xl text-xs transition-all flex items-center gap-2 shadow-2xs"
          >
            <KeyRound className="h-3.5 w-3.5 text-[#C84B18]" />
            <span>View Demo Credentials</span>
          </a>
        </div>
      </section>

      {/* ═══════ WORKFLOW STEP TAB SWITCHER ═══════ */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-6 sm:py-8 space-y-6">
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap border-b border-[#E5E0D8] dark:border-[#292524] pb-4">
          <button
            onClick={() => setActiveWorkflow("teacher")}
            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
              activeWorkflow === "teacher"
                ? "bg-[#C84B18] text-white dark:bg-[#EA580C] shadow-md"
                : "bg-white dark:bg-[#171615] text-[#716D67] hover:text-[#242321] border border-[#E5E0D8] dark:border-[#292524]"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>1. Creator Guide</span>
          </button>

          <button
            onClick={() => setActiveWorkflow("student")}
            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
              activeWorkflow === "student"
                ? "bg-[#C84B18] text-white dark:bg-[#EA580C] shadow-md"
                : "bg-white dark:bg-[#171615] text-[#716D67] hover:text-[#242321] border border-[#E5E0D8] dark:border-[#292524]"
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>2. Student Guide</span>
          </button>

          <button
            onClick={() => setActiveWorkflow("proctoring")}
            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
              activeWorkflow === "proctoring"
                ? "bg-[#C84B18] text-white dark:bg-[#EA580C] shadow-md"
                : "bg-white dark:bg-[#171615] text-[#716D67] hover:text-[#242321] border border-[#E5E0D8] dark:border-[#292524]"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>3. Anti-Cheat</span>
          </button>

          <button
            onClick={() => setActiveWorkflow("analytics")}
            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
              activeWorkflow === "analytics"
                ? "bg-[#C84B18] text-white dark:bg-[#EA580C] shadow-md"
                : "bg-white dark:bg-[#171615] text-[#716D67] hover:text-[#242321] border border-[#E5E0D8] dark:border-[#292524]"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>4. Gradebook</span>
          </button>
        </div>

        {/* ═══════ TAB 1: TEACHER WORKFLOW ═══════ */}
        {activeWorkflow === "teacher" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-[#C84B18]/10 text-[#C84B18] font-bold flex items-center justify-center text-xs">
                01
              </div>
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">Upload Course Documents to Vector KB</h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                Navigate to the <b>Knowledge Base</b> tab. Upload lecture slides, PDFs, or textbooks. The system automatically chunks the text and indexes vector embeddings using Gemini AI.
              </p>
              <div className="p-3 bg-[#F7F4EF] dark:bg-[#141312] rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-[11px] text-[#716D67]">
                Supported formats: PDF, DOCX, TXT, PPTX (Max 25MB per document).
              </div>
            </div>

            <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-[#C84B18]/10 text-[#C84B18] font-bold flex items-center justify-center text-xs">
                02
              </div>
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">AI RAG Assessment Stepper</h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                Use the <b>Assessment Stepper Wizard</b> to specify knowledge sources, topic keywords, question counts, passing marks, and exam timing presets.
              </p>
              <div className="p-3 bg-[#F7F4EF] dark:bg-[#141312] rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-[11px] text-[#716D67]">
                Review and refine questions in Question Studio before publishing.
              </div>
            </div>

            <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-[#C84B18]/10 text-[#C84B18] font-bold flex items-center justify-center text-xs">
                03
              </div>
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">Assessments Table & Live Proctor Hub</h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                Monitor active and scheduled exams from the high-density <b>Assessments Table</b>. Launch Live Proctoring streams or end exams early.
              </p>
              <div className="p-3 bg-[#F7F4EF] dark:bg-[#141312] rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-[11px] text-[#716D67]">
                Students receive automated email notification with test links.
              </div>
            </div>

            <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-[#C84B18]/10 text-[#C84B18] font-bold flex items-center justify-center text-xs">
                04
              </div>
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">Reusable Question Bank Studio</h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                Browse curated questions filtered by difficulty, topic, and subject in the <b>Question Bank Studio</b>.
              </p>
              <div className="p-3 bg-[#F7F4EF] dark:bg-[#141312] rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-[11px] text-[#716D67]">
                Full teacher control over grade release and manual mark overrides.
              </div>
            </div>
          </div>
        )}

        {/* ═══════ TAB 2: STUDENT WORKFLOW ═══════ */}
        {activeWorkflow === "student" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">
                01
              </div>
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">Access Portal or Fast Exam Gateway</h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                Log into the <b>Student Portal</b> with your credentials or paste an Exam Code directly into the fast access gateway on the login screen.
              </p>
            </div>

            <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">
                02
              </div>
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">Complete Anti-Cheat Test Session</h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                Enter your assigned session username/password. Take the test within the countdown timer while anti-cheat telemetry safeguards exam integrity.
              </p>
            </div>

            <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">
                03
              </div>
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">Inspect Official Response Booklet</h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                Once grades are released by your instructor, open your printable Official Response Booklet to review selected answers, correct solutions, and AI feedback.
              </p>
            </div>

            <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">
                04
              </div>
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">Track Learning Trends & Mastery</h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                Check the <b>Learning Trends & Mastery</b> tab in your portal for Recharts performance graphs, topic radar breakdown, and weak-topic recommendations.
              </p>
            </div>
          </div>
        )}

        {/* ═══════ TAB 3: PROCTORING & SECURITY ═══════ */}
        {activeWorkflow === "proctoring" && (
          <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 md:p-8 space-y-6 animate-fadeIn shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-800">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#242321] dark:text-[#F5F5F4]">Real-Time Telemetry & Live Proctor Command Center</h3>
                <p className="text-xs text-[#716D67]">Aegis security engine enforcing exam compliance during live sessions.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1">
                <div className="text-xs font-bold text-[#C84B18]">Tab Focus Tracking</div>
                <p className="text-[11px] text-[#716D67]">Logs tab switches, window minimization, and background application focus losses.</p>
              </div>

              <div className="p-4 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1">
                <div className="text-xs font-bold text-[#C84B18]">Clipboard & DevTools Guard</div>
                <p className="text-[11px] text-[#716D67]">Blocks copy-pasting answers and restricts browser developer tools inspection.</p>
              </div>

              <div className="p-4 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1">
                <div className="text-xs font-bold text-[#C84B18]">WebSockets Teacher Feed</div>
                <p className="text-[11px] text-[#716D67]">Broadcasts real-time violation alerts to the teacher's Live Proctor Command Center.</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ TAB 4: ANALYTICS & GRADEBOOK ═══════ */}
        {activeWorkflow === "analytics" && (
          <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 md:p-8 space-y-6 animate-fadeIn shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 border border-blue-200 dark:border-blue-800">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#242321] dark:text-[#F5F5F4]">Class-Wide Analytics & Response Sheet Exports</h3>
                <p className="text-xs text-[#716D67]">Comprehensive performance breakdown for teachers and individual students.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1">
                <div className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4]">Context-Aware Submission Sorting</div>
                <p className="text-[11px] text-[#716D67]">Multi-candidate submissions sort Student-Wise for teachers, and Exam-Wise for individual students.</p>
              </div>

              <div className="p-4 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1">
                <div className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4]">Printable PDF & Response Sheets</div>
                <p className="text-[11px] text-[#716D67]">Export printable question papers, answer keys, and student response booklets with one click.</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ═══════ DEMO CREDENTIALS SANDBOX ═══════ */}
      <section id="demo-credentials" className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E0D8] dark:border-[#292524] pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[#C84B18]" />
                <span>Demo Test Accounts</span>
              </h2>
              <p className="text-xs text-[#716D67] mt-0.5">Use these credentials to log in and test features instantly.</p>
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
                <div><span className="text-[#716D67]">Email:</span> demo.teacher@eduquizx.com</div>
                <div><span className="text-[#716D67]">Password:</span> demopassword123</div>
              </div>
              <button
                onClick={() => copyToClipboard("demo.teacher@eduquizx.com", "teacher")}
                className="w-full py-1.5 px-3 rounded-lg border border-[#E5E0D8] dark:border-[#292524] hover:bg-white text-xs font-semibold text-[#716D67] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedCred === "teacher" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedCred === "teacher" ? "Copied Email!" : "Copy Teacher Email"}</span>
              </button>
            </div>

            {/* Student Credential Card */}
            <div className="p-4 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Student Portal Account</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Student Role</span>
              </div>
              <div className="space-y-1 text-xs font-mono bg-white dark:bg-[#171615] p-3 rounded-lg border border-[#E5E0D8] dark:border-[#292524]">
                <div><span className="text-[#716D67]">Email:</span> demo.student@eduquizx.com</div>
                <div><span className="text-[#716D67]">Password:</span> demopassword123</div>
              </div>
              <button
                onClick={() => copyToClipboard("demo.student@eduquizx.com", "student")}
                className="w-full py-1.5 px-3 rounded-lg border border-[#E5E0D8] dark:border-[#292524] hover:bg-white text-xs font-semibold text-[#716D67] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedCred === "student" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedCred === "student" ? "Copied Email!" : "Copy Student Email"}</span>
              </button>
            </div>
          </div>
        </div>
      </section>



      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-[#E5E0D8] dark:border-[#292524] py-8 text-center text-xs text-[#716D67]">
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

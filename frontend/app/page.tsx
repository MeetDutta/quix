"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../store/authStore";
import { apiFetch } from "../lib/api";
import { 
  School, 
  FileEdit, 
  GraduationCap, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  BookOpen, 
  ShieldCheck, 
  ShieldAlert, 
  BarChart3, 
  KeyRound, 
  Sun, 
  Moon, 
  LogOut, 
  User, 
  FileCode2, 
  Play, 
  Copy, 
  Check, 
  ExternalLink,
  Layers,
  Lock,
  Clock,
  Award,
  Zap,
  HelpCircle,
  LogIn
} from "lucide-react";

export default function UnifiedHomePage() {
  const router = useRouter();
  const { token, fullName, role, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [directExamCode, setDirectExamCode] = useState("");
  const [copiedCred, setCopiedCred] = useState<string | null>(null);
  const [activeGuideTab, setActiveGuideTab] = useState<"creator" | "student" | "proctor" | "analytics">("creator");
  const [loggingInRole, setLoggingInRole] = useState<string | null>(null);

  const handleQuickDemoLogin = async (email: string, pass: string, roleKey: string) => {
    setLoggingInRole(roleKey);
    try {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await res.json();
      if (res.ok && data.access_token) {
        useAuthStore.getState().setAuth(
          data.access_token,
          data.role,
          data.full_name,
          data.institution_id
        );
        if (data.workspace_id) {
          localStorage.setItem("workspaceId", data.workspace_id);
          localStorage.setItem("workspaceName", data.workspace_name || "Personal Workspace");
        }
        if (data.role === "student") {
          router.push("/dashboard/student");
        } else {
          router.push("/dashboard/teacher");
        }
      } else {
        router.push(`/login?role=${roleKey}`);
      }
    } catch {
      router.push(`/login?role=${roleKey}`);
    } finally {
      setLoggingInRole(null);
    }
  };

  useEffect(() => {
    setMounted(true);
    const savedTheme = (localStorage.getItem("theme") as "light" | "dark") || "light";
    setTheme(savedTheme);
    if (savedTheme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    if (next === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  };

  const isTeacher = role === "teacher" || role === "inst_admin" || role === "super_admin";

  const handleTeacherModeSelect = () => {
    if (token) {
      router.push("/dashboard/teacher");
    } else {
      router.push("/login?role=teacher&target=teacher_dashboard");
    }
  };

  const handleStudentModeSelect = () => {
    if (token) {
      router.push("/dashboard/student");
    } else {
      router.push("/login?role=student&target=student_dashboard");
    }
  };

  const handleDirectExamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directExamCode.trim()) return;
    const cleanCode = directExamCode.trim().replace(/^.*\/exam\//, "");
    router.push(`/exam/${cleanCode}`);
  };

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
    <div className="min-h-screen bg-[#F7F4EF] dark:bg-[#0F0E0D] text-[#242321] dark:text-[#F5F5F4] transition-colors duration-200 selection:bg-[#C84B18]/20 flex flex-col justify-between">
      
      {/* ══════════════════════════════════════════════════════════════════════
          TOP NAVIGATION BAR
      ══════════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-[#F7F4EF]/90 dark:bg-[#0F0E0D]/90 backdrop-blur-md border-b border-[#E5E0D8] dark:border-[#292524] px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#C84B18] dark:bg-[#EA580C] text-white shadow-sm shadow-[#C84B18]/20">
            <School className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-[#242321] dark:text-[#F5F5F4]">EduQuizX</span>
              <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C]">
                v2.4
              </span>
            </div>
            <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E] font-medium hidden md:block">
              Autonomous AI Examination & Live Proctoring Platform
            </p>
          </div>
        </div>

        {/* Action Controls & User Auth Bar */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Quick Anchor Links */}
          <button
            onClick={() => scrollToSection("mode-selection")}
            className="hidden lg:inline-flex text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] hover:text-[#C84B18] dark:hover:text-[#EA580C] transition-colors px-2 py-1 cursor-pointer"
          >
            Select Mode
          </button>
          <button
            onClick={() => scrollToSection("platform-guide")}
            className="hidden lg:inline-flex text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] hover:text-[#C84B18] dark:hover:text-[#EA580C] transition-colors px-2 py-1 cursor-pointer"
          >
            User Guide
          </button>
          <button
            onClick={() => scrollToSection("demo-credentials")}
            className="hidden lg:inline-flex text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] hover:text-[#C84B18] dark:hover:text-[#EA580C] transition-colors px-2 py-1 cursor-pointer"
          >
            Demo Accounts
          </button>

          {/* Dark / Light Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-11 h-6 rounded-full bg-[#E5E0D8] dark:bg-[#292524] border border-[#E5E0D8] dark:border-[#292524] p-0.5 flex items-center shadow-2xs cursor-pointer transition-colors duration-300 relative focus:outline-none"
            title={`Switch to ${theme === "light" ? "Dark" : "Light"} mode`}
            aria-label="Toggle Theme"
          >
            <div
              className={`w-5 h-5 rounded-full bg-white dark:bg-[#EA580C] shadow-2xs border border-[#E5E0D8] dark:border-transparent transform transition-transform duration-300 flex items-center justify-center ${
                theme === "dark" ? "translate-x-5 text-white" : "translate-x-0 text-[#C84B18]"
              }`}
            >
              {theme === "light" ? <Sun className="h-2.5 w-2.5" /> : <Moon className="h-2.5 w-2.5" />}
            </div>
          </button>

          {/* User Auth Status or Login CTAs */}
          {mounted && token ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-[#242321] dark:text-[#F5F5F4] max-w-[120px] truncate">{fullName || "User"}</span>
                <span className="text-[10px] uppercase font-bold text-[#C84B18] dark:text-[#EA580C] bg-[#C84B18]/10 dark:bg-[#EA580C]/15 px-1.5 py-0.5 rounded">
                  {role}
                </span>
              </div>
              <button
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="p-2 rounded-xl bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-rose-600 transition-colors shadow-2xs cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/login")}
                className="px-3.5 py-1.5 rounded-xl border border-[#E5E0D8] dark:border-[#292524] bg-white dark:bg-[#171615] hover:bg-[#F0ECE4]/60 dark:hover:bg-[#292524] text-xs font-bold text-[#242321] dark:text-[#F5F5F4] transition-all shadow-2xs cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={() => router.push("/login?mode=signup")}
                className="px-3.5 py-1.5 rounded-xl bg-[#C84B18] hover:bg-[#B33E0F] dark:bg-[#EA580C] dark:hover:bg-[#C2410C] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Register
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          HERO & MODE SELECTION HUB
      ══════════════════════════════════════════════════════════════════════ */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-10 sm:py-14 space-y-12 w-full">
        
        {/* Hero Title */}
        <section className="text-center space-y-3.5 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#C84B18]/10 dark:bg-[#EA580C]/15 border border-[#C84B18]/20 dark:border-[#EA580C]/30 text-[#C84B18] dark:text-[#EA580C] text-xs font-bold shadow-2xs">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Select Your Operational Mode to Begin</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[#242321] dark:text-[#F5F5F4] leading-tight">
            Next-Gen Autonomous <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C84B18] via-amber-600 to-[#EA580C]">
              Assessment & Proctoring
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-[#716D67] dark:text-[#A8A29E] font-medium max-w-2xl mx-auto leading-relaxed">
            Choose whether you want to build and supervise examinations as an instructor, or enter the secure student portal to attempt an assessment.
          </p>
        </section>

        {/* ═══════ THE 2 CORE WORKSPACE MODE CARDS ═══════ */}
        {/* ═══════ THE 2 CORE WORKSPACE MODE CARDS (SIDE-BY-SIDE ON ALL SCREENS) ═══════ */}
        <section id="mode-selection" className="grid grid-cols-2 gap-3 sm:gap-6 max-w-5xl mx-auto">
          
          {/* CARD 1: CREATE TEST (TEACHER STUDIO) */}
          <div
            onClick={handleTeacherModeSelect}
            className="group relative bg-white dark:bg-[#171615] rounded-2xl sm:rounded-3xl border-2 border-[#E5E0D8] dark:border-[#292524] hover:border-[#C84B18] dark:hover:border-[#EA580C] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 sm:h-2 bg-gradient-to-r from-[#C84B18] via-amber-500 to-[#C84B18] z-10" />
            
            <div>
              {/* Photo Banner on Top */}
              <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] overflow-hidden bg-[#F0ECE4] dark:bg-[#242321]">
                <img
                  src="/images/teacher_mode.jpg"
                  alt="Instructor Studio"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 pointer-events-none" />
                <span className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 text-[9px] sm:text-[11px] font-bold tracking-wider uppercase px-2 sm:px-2.5 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-xs border border-white/20">
                  Instructor Studio
                </span>
              </div>

              <div className="p-3.5 sm:p-6 space-y-2 sm:space-y-3">
                <h2 className="text-base sm:text-2xl font-extrabold text-[#242321] dark:text-[#F5F5F4] tracking-tight group-hover:text-[#C84B18] dark:group-hover:text-[#EA580C] transition-colors leading-tight">
                  Create Test
                </h2>
                <p className="text-[11px] sm:text-xs text-[#716D67] dark:text-[#A8A29E] font-medium leading-relaxed line-clamp-2 sm:line-clamp-none">
                  Design syllabus blueprints, upload course files to RAG vector knowledge base, and export analytics.
                </p>

                <ul className="hidden sm:space-y-2 text-xs text-[#57534E] dark:text-[#A8A29E] font-medium border-t border-[#E5E0D8]/60 dark:border-[#292524]/60 pt-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#C84B18] dark:text-[#EA580C] shrink-0" />
                    <span className="truncate">AI Question Generator with Direct Document Upload</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#C84B18] dark:text-[#EA580C] shrink-0" />
                    <span className="truncate">Multi-modal Knowledge Base (PDF, DOCX, XLSX, TXT)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#C84B18] dark:text-[#EA580C] shrink-0" />
                    <span className="truncate">Live Proctoring Radar & Real-Time Logs</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="p-3.5 sm:p-6 pt-0">
              <button 
                type="button"
                className="w-full bg-[#C84B18] hover:bg-[#B33E0F] dark:bg-[#EA580C] dark:hover:bg-[#C2410C] text-white font-bold rounded-xl py-2.5 sm:py-3 text-[11px] sm:text-xs transition-all shadow-md shadow-[#C84B18]/20 flex items-center justify-center gap-1.5 sm:gap-2 group-hover:gap-3 cursor-pointer"
              >
                <span>{mounted && token && isTeacher ? "Open Studio" : "Create Test"}</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          {/* CARD 2: TAKE TEST (STUDENT PORTAL) */}
          <div
            onClick={handleStudentModeSelect}
            className="group relative bg-white dark:bg-[#171615] rounded-2xl sm:rounded-3xl border-2 border-[#E5E0D8] dark:border-[#292524] hover:border-emerald-600 dark:hover:border-emerald-500 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 sm:h-2 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 z-10" />
            
            <div>
              {/* Photo Banner on Top */}
              <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] overflow-hidden bg-[#F0ECE4] dark:bg-[#242321]">
                <img
                  src="/images/student_mode.jpg"
                  alt="Candidate Portal"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 pointer-events-none" />
                <span className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 text-[9px] sm:text-[11px] font-bold tracking-wider uppercase px-2 sm:px-2.5 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-xs border border-white/20">
                  Candidate Portal
                </span>
              </div>

              <div className="p-3.5 sm:p-6 space-y-2 sm:space-y-3">
                <h2 className="text-base sm:text-2xl font-extrabold text-[#242321] dark:text-[#F5F5F4] tracking-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors leading-tight">
                  Take Test
                </h2>
                <p className="text-[11px] sm:text-xs text-[#716D67] dark:text-[#A8A29E] font-medium leading-relaxed line-clamp-2 sm:line-clamp-none">
                  Student workspace for attempting assigned assessments and entering timed passcode rooms.
                </p>

                <ul className="hidden sm:space-y-2 text-xs text-[#57534E] dark:text-[#A8A29E] font-medium border-t border-[#E5E0D8]/60 dark:border-[#292524]/60 pt-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">1-Click Launch with Auto-Provisioned Credentials</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">Real-time Response Cloud Synchronization</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">Anti-Cheat HUD with Tab-Switch Telemetry</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="p-3.5 sm:p-6 pt-0">
              <button 
                type="button"
                className="w-full bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold rounded-xl py-2.5 sm:py-3 text-[11px] sm:text-xs transition-all shadow-md shadow-emerald-700/20 flex items-center justify-center gap-1.5 sm:gap-2 group-hover:gap-3 cursor-pointer"
              >
                <span>{mounted && token ? "Open Portal" : "Take Test"}</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            </div>
          </div>

        </section>

        {/* ═══════ FAST DIRECT EXAM CODE JUMP BAR ═══════ */}
        <section className="max-w-5xl mx-auto">
          <div className="p-5 sm:p-6 bg-white dark:bg-[#171615] rounded-2xl border border-[#E5E0D8] dark:border-[#292524] shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] flex items-center justify-center shrink-0">
                <FileCode2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#242321] dark:text-[#F5F5F4]">
                  Have a Direct Exam Code from Your Instructor?
                </h3>
                <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                  Paste your test code below to jump directly into the candidate testing gateway.
                </p>
              </div>
            </div>

            <form onSubmit={handleDirectExamSubmit} className="flex items-center gap-2 w-full md:w-auto">
              <input
                type="text"
                value={directExamCode}
                onChange={(e) => setDirectExamCode(e.target.value)}
                placeholder="e.g. ex-compi-6356"
                className="w-full md:w-52 px-3.5 py-2 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] text-xs font-mono text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:ring-1 focus:ring-[#C84B18]"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#242321] hover:bg-black dark:bg-[#F5F5F4] dark:hover:bg-white text-white dark:text-[#242321] font-bold text-xs transition-all shrink-0 cursor-pointer shadow-xs"
              >
                Join Room
              </button>
            </form>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            INTEGRATED PLATFORM ARCHITECTURE & USER GUIDE
        ══════════════════════════════════════════════════════════════════════ */}
        <section id="platform-guide" className="max-w-5xl mx-auto space-y-6 pt-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-[#242321] dark:text-[#F5F5F4]">
              Platform Capabilities & System Architecture
            </h2>
            <p className="text-xs sm:text-sm text-[#716D67] dark:text-[#A8A29E] max-w-xl mx-auto">
              Explore how EduQuizX orchestrates AI question synthesis, multi-format knowledge indexing, and live telemetry proctoring.
            </p>
          </div>

          {/* Guide Tab Switcher */}
          <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-1 scrollbar-none touch-pan-x sm:flex-wrap">
            <button
              onClick={() => setActiveGuideTab("creator")}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer ${
                activeGuideTab === "creator"
                  ? "bg-[#C84B18] text-white shadow-xs"
                  : "bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321]"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>1. Teacher Creator Studio</span>
            </button>

            <button
              onClick={() => setActiveGuideTab("student")}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer ${
                activeGuideTab === "student"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321]"
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              <span>2. Student Test Runner</span>
            </button>

            <button
              onClick={() => setActiveGuideTab("proctor")}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer ${
                activeGuideTab === "proctor"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321]"
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>3. Anti-Cheat Telemetry</span>
            </button>

            <button
              onClick={() => setActiveGuideTab("analytics")}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer ${
                activeGuideTab === "analytics"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321]"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>4. Evaluation & Gradebook</span>
            </button>
          </div>

          {/* Guide Content Display Card */}
          <div className="bg-white dark:bg-[#171615] rounded-2xl border border-[#E5E0D8] dark:border-[#292524] p-6 sm:p-8 shadow-xs">
            {activeGuideTab === "creator" && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center gap-2.5 text-[#C84B18] dark:text-[#EA580C]">
                  <FileEdit className="h-5 w-5" />
                  <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">Instructor 4-Step Assessment Creator</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                    <div className="font-bold text-[#C84B18]">Step 1: Knowledge Base</div>
                    <p className="text-[#716D67] dark:text-[#A8A29E]">Select existing document or upload new PDF/PPTX/TXT files directly for instant ChromaDB vector embedding.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                    <div className="font-bold text-[#C84B18]">Step 2: AI Blueprint</div>
                    <p className="text-[#716D67] dark:text-[#A8A29E]">Configure MCQ / short answer distributions, difficulty levels, and syllabus coverage targets.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                    <div className="font-bold text-[#C84B18]">Step 3: Question Editor</div>
                    <p className="text-[#716D67] dark:text-[#A8A29E]">Review AI generated questions with LaTeX math rendering, live editing, and custom question additions.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                    <div className="font-bold text-[#C84B18]">Step 4: Scheduling</div>
                    <p className="text-[#716D67] dark:text-[#A8A29E]">Assign test windows, fullscreen enforcement rules, calculators, and generate candidate passcodes.</p>
                  </div>
                </div>
              </div>
            )}

            {activeGuideTab === "student" && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
                  <GraduationCap className="h-5 w-5" />
                  <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">Candidate Testing & Response Sync</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                    <div className="font-bold text-emerald-600">1-Click Fast Gateway</div>
                    <p className="text-[#716D67] dark:text-[#A8A29E]">Authenticated students launch assessments with 1-click without entering passwords, or use 6-digit access PINs.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                    <div className="font-bold text-emerald-600">Dual Sync Engine</div>
                    <p className="text-[#716D67] dark:text-[#A8A29E]">Every response is backed up in LocalStorage and synchronized to the SQLite/PostgreSQL cloud store on keystroke.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                    <div className="font-bold text-emerald-600">Built-in Scientific Tools</div>
                    <p className="text-[#716D67] dark:text-[#A8A29E]">Includes floating scientific calculator, formula rendering, flag for review, and keyboard shortcuts (A-D, F, Arrows).</p>
                  </div>
                </div>
              </div>
            )}

            {activeGuideTab === "proctor" && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="h-5 w-5" />
                  <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">Live Anti-Cheat & Proctoring Radar</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                    <div className="font-bold text-rose-600">Tab-Switch Interception</div>
                    <p className="text-[#716D67] dark:text-[#A8A29E]">Automated 3-strike tab switch enforcement with progressive warning toasts and automatic test submission on violation #3.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                    <div className="font-bold text-rose-600">Live WebSocket Telemetry</div>
                    <p className="text-[#716D67] dark:text-[#A8A29E]">Real-time websocket telemetry stream push alerts directly to the instructor's live proctoring grid.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                    <div className="font-bold text-rose-600">Clipboard & Window Lockdown</div>
                    <p className="text-[#716D67] dark:text-[#A8A29E]">Copy-paste interception, fullscreen enforcement, and right-click blocking maintain examination integrity.</p>
                  </div>
                </div>
              </div>
            )}

            {activeGuideTab === "analytics" && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                  <BarChart3 className="h-5 w-5" />
                  <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">Instant Grading & Response Booklets</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                    <div className="font-bold text-blue-600">Instant AI Grading</div>
                    <p className="text-[#716D67] dark:text-[#A8A29E]">Objective questions graded immediately; subjective answers evaluated by Gemini with constructive feedback.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                    <div className="font-bold text-blue-600">Topic-by-Topic Radar</div>
                    <p className="text-[#716D67] dark:text-[#A8A29E]">Radar charts break down candidate strengths, weak topics, cohort percentile ranks, and passing trends.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1.5">
                    <div className="font-bold text-blue-600">Export & PDF Generation</div>
                    <p className="text-[#716D67] dark:text-[#A8A29E]">1-click PDF booklet downloads, official cohort gradebook spreadsheets, and audit logs.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            DEMO CREDENTIALS SECTION
        ══════════════════════════════════════════════════════════════════════ */}
        <section id="demo-credentials" className="max-w-5xl mx-auto space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#716D67]">
              <KeyRound className="h-4 w-4 text-[#C84B18]" />
              <span>Instant Demo Accounts</span>
            </div>
            <span className="text-[11px] text-[#716D67]">Click any account to copy credentials</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Teacher Demo Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C]">
                      <FileEdit className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-[#242321] dark:text-[#F5F5F4]">Instructor / Teacher Demo</h4>
                      <span className="text-[10px] text-[#716D67]">Dr. Sarah Jenkins · Full creator privileges</span>
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard("teacher@aegeus.edu\nsecurepassword", "teacher")}
                    className="px-2.5 py-1 rounded-lg bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] text-[11px] font-semibold text-[#716D67] hover:text-[#242321] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copiedCred === "teacher" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedCred === "teacher" ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
                <div className="font-mono text-xs p-2.5 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1 mt-3">
                  <div className="flex justify-between"><span className="text-[#716D67]">Email:</span> <b className="text-[#242321] dark:text-[#F5F5F4]">teacher@aegeus.edu</b></div>
                  <div className="flex justify-between"><span className="text-[#716D67]">Pass:</span> <b className="text-[#C84B18] dark:text-[#EA580C]">securepassword</b></div>
                </div>
              </div>
              <button
                type="button"
                disabled={loggingInRole === "teacher"}
                onClick={() => handleQuickDemoLogin("teacher@aegeus.edu", "securepassword", "teacher")}
                className="w-full py-2 px-3 bg-[#C84B18] hover:bg-[#B33E0F] dark:bg-[#EA580C] dark:hover:bg-[#C2410C] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {loggingInRole === "teacher" ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Launching Studio...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-3.5 w-3.5" />
                    <span>1-Click Launch Instructor Studio</span>
                  </>
                )}
              </button>
            </div>

            {/* Student Demo Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-[#242321] dark:text-[#F5F5F4]">Student / Candidate Demo</h4>
                      <span className="text-[10px] text-[#716D67]">Alex Johnson · Enrolled candidate testing portal</span>
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard("student@aegeus.edu\nsecurepassword", "student")}
                    className="px-2.5 py-1 rounded-lg bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] text-[11px] font-semibold text-[#716D67] hover:text-[#242321] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copiedCred === "student" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedCred === "student" ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
                <div className="font-mono text-xs p-2.5 rounded-xl bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] space-y-1 mt-3">
                  <div className="flex justify-between"><span className="text-[#716D67]">Email:</span> <b className="text-[#242321] dark:text-[#F5F5F4]">student@aegeus.edu</b></div>
                  <div className="flex justify-between"><span className="text-[#716D67]">Pass:</span> <b className="text-emerald-600 dark:text-emerald-400">securepassword</b></div>
                </div>
              </div>
              <button
                type="button"
                disabled={loggingInRole === "student"}
                onClick={() => handleQuickDemoLogin("student@aegeus.edu", "securepassword", "student")}
                className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {loggingInRole === "student" ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Launching Portal...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-3.5 w-3.5" />
                    <span>1-Click Launch Candidate Portal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* ══════════════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════════════ */}
      <footer className="w-full border-t border-[#E5E0D8] dark:border-[#292524] bg-white dark:bg-[#171615] px-4 md:px-8 py-5 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#716D67] dark:text-[#A8A29E]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>EduQuizX Autonomous AI Assessment System • AES-256 Cloud Lockdown</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/guide" className="hover:text-[#C84B18] dark:hover:text-[#EA580C] transition-colors">Platform Manual</a>
            <span>•</span>
            <a href="/login" className="hover:text-[#C84B18] dark:hover:text-[#EA580C] transition-colors">Login Gateway</a>
            <span>•</span>
            <a href="/dashboard/teacher" className="hover:text-[#C84B18] dark:hover:text-[#EA580C] transition-colors">Teacher Studio</a>
          </div>
        </div>
      </footer>

    </div>
  );
}

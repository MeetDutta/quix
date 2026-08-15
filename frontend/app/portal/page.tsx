"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/authStore";
import { 
  FileEdit, 
  GraduationCap, 
  School, 
  LogOut, 
  Sun, 
  Moon, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  BookOpen, 
  ShieldCheck, 
  Layers, 
  Users, 
  BarChart3, 
  UserCheck,
  FileCode2,
  KeyRound
} from "lucide-react";

export default function PortalSelectPage() {
  const router = useRouter();
  const { token, fullName, role, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setMounted(true);
    const savedTheme = (localStorage.getItem("theme") as "light" | "dark") || "light";
    setTheme(savedTheme);
    if (savedTheme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    if (mounted && !token) {
      router.replace("/login");
    }
  }, [mounted, token, router]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    if (next === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  };

  const isTeacher = role === "teacher" || role === "inst_admin" || role === "super_admin";

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (!mounted || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F4EF] dark:bg-[#0F0E0D]">
        <div className="flex items-center gap-3 bg-white dark:bg-[#171615] px-5 py-3.5 rounded-xl border border-[#E5E0D8] dark:border-[#292524] shadow-xs">
          <div className="w-4 h-4 rounded-full border-2 border-[#C84B18] dark:border-[#EA580C] border-t-transparent animate-spin" />
          <span className="font-medium text-xs text-[#242321] dark:text-[#F5F5F4]">Loading Portal...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4EF] dark:bg-[#0F0E0D] text-[#242321] dark:text-[#F5F5F4] transition-colors duration-200 relative overflow-hidden flex flex-col justify-between p-4 sm:p-8">
      
      {/* Background Decorative Ambient Flares */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#C84B18]/5 dark:bg-[#EA580C]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#C84B18]/5 dark:bg-[#EA580C]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between z-10 py-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#C84B18] dark:bg-[#EA580C] text-white shadow-md shadow-[#C84B18]/15">
            <School className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-[#242321] dark:text-[#F5F5F4] leading-none">EduQuizX</h1>
            <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E] font-medium tracking-wide mt-0.5">Autonomous Examination System</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="w-12 h-6.5 rounded-full bg-[#E5E0D8] dark:bg-[#292524] border border-[#E5E0D8] dark:border-[#292524] p-1 flex items-center shadow-2xs cursor-pointer transition-colors duration-300 relative focus:outline-none"
            title={`Switch to ${theme === "light" ? "Dark" : "Light"} mode`}
            aria-label="Toggle Theme"
          >
            <div
              className={`w-4.5 h-4.5 rounded-full bg-white dark:bg-[#EA580C] shadow-2xs border border-[#E5E0D8] dark:border-transparent transform transition-transform duration-300 flex items-center justify-center ${
                theme === "dark" ? "translate-x-5.5 text-white" : "translate-x-0 text-[#C84B18]"
              }`}
            >
              {theme === "light" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
            </div>
          </button>

          {/* Sign Out Button */}
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] hover:text-[#C84B18] dark:hover:text-[#EA580C] transition-all shadow-2xs cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-5xl mx-auto z-10 my-auto py-8 space-y-8">
        
        {/* Welcome Headline */}
        <div className="text-center space-y-2.5 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#C84B18]/10 dark:bg-[#EA580C]/15 border border-[#C84B18]/20 dark:border-[#EA580C]/30 text-[#C84B18] dark:text-[#EA580C] text-xs font-bold shadow-2xs">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Authenticated as {fullName || "User"}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#242321] dark:text-[#F5F5F4]">
            Select Your Workspace Mode
          </h2>
          <p className="text-sm text-[#716D67] dark:text-[#A8A29E] font-medium leading-relaxed">
            Choose whether to build, schedule & monitor examinations or launch the student assessment portal.
          </p>
        </div>

        {/* Main Workspace Cards */}
        <div className={`grid grid-cols-1 ${isTeacher ? "md:grid-cols-2 max-w-5xl" : "max-w-md"} gap-6 sm:gap-8 mx-auto w-full`}>
          
          {/* CARD 1: CREATE TEST (Visible to Teachers / Admins only) */}
          {isTeacher && (
            <div 
              onClick={() => router.push("/dashboard/teacher")}
              className="group relative bg-white dark:bg-[#171615] rounded-3xl p-7 sm:p-8 border border-[#E5E0D8] dark:border-[#292524] hover:border-[#C84B18] dark:hover:border-[#EA580C] shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#C84B18] via-amber-500 to-[#C84B18]" />
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-[#FFF8F5] dark:bg-[#292524] border border-[#F7D5CA] dark:border-[#383330] text-[#C84B18] dark:text-[#EA580C] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform duration-300">
                    <FileEdit className="h-7 w-7" />
                  </div>
                  <span className="text-[11px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full bg-[#FFF8F5] dark:bg-[#292524] text-[#C84B18] dark:text-[#EA580C] border border-[#F7D5CA] dark:border-[#383330]">
                    Creator Studio
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-[#242321] dark:text-[#F5F5F4] tracking-tight group-hover:text-[#C84B18] dark:group-hover:text-[#EA580C] transition-colors">
                    Create Test
                  </h3>
                  <p className="text-xs text-[#716D67] dark:text-[#A8A29E] font-medium mt-1.5 leading-relaxed">
                    Full suite for designing, scheduling, and managing autonomous AI examinations.
                  </p>
                </div>

                <ul className="space-y-2.5 text-xs text-[#57534E] dark:text-[#A8A29E] font-medium border-t border-[#E5E0D8]/60 dark:border-[#292524]/60 pt-5">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-[#C84B18] dark:text-[#EA580C] shrink-0" />
                    <span>AI Exam Blueprint & Non-Repeating Questions</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-[#C84B18] dark:text-[#EA580C] shrink-0" />
                    <span>Multi-format RAG Subject Knowledge Base</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-[#C84B18] dark:text-[#EA580C] shrink-0" />
                    <span>Bulk CSV Roster & Credentials Generator</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-[#C84B18] dark:text-[#EA580C] shrink-0" />
                    <span>Live Proctoring Command Center & Gradebooks</span>
                  </li>
                </ul>
              </div>

              <div className="pt-8">
                <button 
                  type="button"
                  className="w-full bg-[#C84B18] hover:bg-[#B33E0F] dark:bg-[#EA580C] dark:hover:bg-[#C2410C] text-white font-bold rounded-xl py-3.5 text-xs transition-all shadow-md shadow-[#C84B18]/20 flex items-center justify-center gap-2 group-hover:gap-3"
                >
                  <span>Launch Test Creator Studio</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          )}

          {/* CARD 2: TAKE TEST */}
          <div 
            onClick={() => router.push("/dashboard/student")}
            className="group relative bg-white dark:bg-[#171615] rounded-3xl p-7 sm:p-8 border border-[#E5E0D8] dark:border-[#292524] hover:border-emerald-600 dark:hover:border-emerald-500 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600" />
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform duration-300">
                  <GraduationCap className="h-7 w-7" />
                </div>
                <span className="text-[11px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                  {isTeacher ? "Teacher Preview Mode" : "Student Mode"}
                </span>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-[#242321] dark:text-[#F5F5F4] tracking-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                  Take Test
                </h3>
                <p className="text-xs text-[#716D67] dark:text-[#A8A29E] font-medium mt-1.5 leading-relaxed">
                  Student portal for attempting live exams, entering passcodes, and viewing performance.
                </p>
              </div>

              <ul className="space-y-2.5 text-xs text-[#57534E] dark:text-[#A8A29E] font-medium border-t border-[#E5E0D8]/60 dark:border-[#292524]/60 pt-5">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Live Assigned Examinations & Countdown Timer</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Direct Exam Code Access & Candidate Login</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Proctored Secure Exam Environment</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Printable Response Booklet & Scorecard Download</span>
                </li>
              </ul>
            </div>

            <div className="pt-8">
              <button 
                type="button"
                className="w-full bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold rounded-xl py-3.5 text-xs transition-all shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 group-hover:gap-3"
              >
                <span>Launch Student Exam Portal</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            </div>
          </div>

        </div>

      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-6xl mx-auto z-10 py-3 border-t border-[#E5E0D8]/60 dark:border-[#292524]/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#716D67] dark:text-[#A8A29E]">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>EduQuizX Autonomous Portal</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/guide" className="hover:text-[#C84B18] dark:hover:text-[#EA580C] hover:underline">Platform Guide</a>
          <span>•</span>
          <span>Logged in as <strong>{role}</strong></span>
        </div>
      </footer>
    </div>
  );
}

"use client";

import { useAuthStore } from "../../store/authStore";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  GraduationCap, 
  BookOpen, 
  School, 
  Menu, 
  X, 
  LogOut, 
  Settings, 
  Bell, 
  ExternalLink,
  UserCheck,
  Compass,
  FileCode2
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, fullName, role, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !token) {
      router.replace("/");
    }
  }, [mounted, token, router]);

  useEffect(() => {
    if (mounted && token && role === "student" && pathname === "/dashboard/teacher") {
      router.push("/dashboard/student");
    }
  }, [mounted, token, role, pathname, router]);

  if (!mounted) {
    return (
      <div className="flex h-screen bg-[#FAF7F2] items-center justify-center text-[#78716C] text-sm">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl shadow-sm border border-[#E7E0D3]">
          <div className="w-5 h-5 rounded-full border-2 border-[#9A3412] border-t-transparent animate-spin" />
          <span className="font-medium text-[#292524]">Loading EduQuizX...</span>
        </div>
      </div>
    );
  }

  if (!token) {
    return null;
  }

  const isTeacher = role === "teacher" || role === "inst_admin" || role === "super_admin";

  return (
    <div className="flex h-screen bg-[#FAF7F2] overflow-hidden text-[#1C1917]">
      
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside 
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#F5F0E8] border-r border-[#E7E0D3] flex flex-col shrink-0 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand / Title Header */}
        <div className="p-5 border-b border-[#E7E0D3] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#9A3412] text-white shadow-sm">
              <School className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-[#292524] text-base leading-snug">EduQuizX</h1>
              <p className="text-xs text-[#78716C]">Classroom Evaluation</p>
            </div>
          </div>
          {/* Mobile close button */}
          <button 
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-[#78716C] hover:text-[#1C1917] hover:bg-[#EAE3D5]"
            aria-label="Close sidebar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Navigation Section */}
        <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
          {/* Main Portals Group */}
          <div>
            <div className="text-[11px] font-bold text-[#A8A29E] px-3 mb-2 uppercase tracking-wider">
              Portals
            </div>
            <div className="space-y-1">
              {isTeacher && (
                <a 
                  href="/dashboard/teacher" 
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    pathname === "/dashboard/teacher"
                      ? "bg-[#FCEBE6] text-[#9A3412] border border-[#F7D5CA] shadow-xs"
                      : "text-[#57534E] hover:text-[#1C1917] hover:bg-[#EAE3D5]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <GraduationCap className={`h-4.5 w-4.5 ${pathname === "/dashboard/teacher" ? "text-[#9A3412]" : "text-[#78716C]"}`} />
                    <span>Quiz Creator</span>
                  </div>
                  {pathname === "/dashboard/teacher" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#9A3412]" />
                  )}
                </a>
              )}

              <a 
                href="/dashboard/student" 
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  pathname === "/dashboard/student"
                    ? "bg-[#FCEBE6] text-[#9A3412] border border-[#F7D5CA] shadow-xs"
                    : "text-[#57534E] hover:text-[#1C1917] hover:bg-[#EAE3D5]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <UserCheck className={`h-4.5 w-4.5 ${pathname === "/dashboard/student" ? "text-[#9A3412]" : "text-[#78716C]"}`} />
                  <span>Student Portal</span>
                </div>
                {pathname === "/dashboard/student" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9A3412]" />
                )}
              </a>
            </div>
          </div>

          {/* Static Developer Playground */}
          <div>
            <div className="text-[11px] font-bold text-[#A8A29E] px-3 mb-2 uppercase tracking-wider">
              Static Playground
            </div>
            <div className="space-y-1">
              <a 
                href="http://localhost:8000/static/index.html" 
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-[#57534E] hover:text-[#9A3412] hover:bg-[#EAE3D5] transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <FileCode2 className="h-4.5 w-4.5 text-[#78716C]" />
                  <span>Quiz Creator HTML Page</span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-[#A8A29E]" />
              </a>

              <a 
                href="http://localhost:8000/static/exam.html" 
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-[#57534E] hover:text-[#9A3412] hover:bg-[#EAE3D5] transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Compass className="h-4.5 w-4.5 text-[#78716C]" />
                  <span>Student Exam Page</span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-[#A8A29E]" />
              </a>
            </div>
          </div>
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-[#E7E0D3] bg-[#EFE8DC]/50 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-9 w-9 rounded-xl bg-[#9A3412] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              {fullName ? fullName[0] : "C"}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs text-[#78716C] capitalize font-medium">{role || "Quiz Creator"}</div>
              <div className="text-sm font-semibold text-[#292524] truncate leading-tight">{fullName || "Quiz Creator"}</div>
            </div>
          </div>
          <button 
            onClick={() => { logout(); router.push("/"); }}
            className="p-2 rounded-xl text-[#78716C] hover:text-[#9A3412] hover:bg-[#EADFCF] transition-all"
            title="Log out"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top App Bar Header */}
        <header className="h-14 border-b border-[#E7E0D3] bg-[#FAF7F2] px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger Button for Mobile */}
            <button 
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl text-[#57534E] hover:text-[#1C1917] hover:bg-[#EAE3D5] transition-all"
              aria-label="Open sidebar menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-xs md:text-sm text-[#78716C]">
              <span>EduQuizX</span>
              <span>/</span>
              <span className="font-bold text-[#292524]">
                {pathname === "/dashboard/teacher" ? "Quiz Creator" : "Student Portal"}
              </span>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Server Online
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 rounded-xl text-[#78716C] hover:text-[#1C1917] hover:bg-[#EAE3D5] transition-all relative">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#9A3412]" />
            </button>
            <button className="p-2 rounded-xl text-[#78716C] hover:text-[#1C1917] hover:bg-[#EAE3D5] transition-all">
              <Settings className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>
        
        {/* Page Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#FAF7F2]">
          {children}
        </main>
      </div>
    </div>
  );
}

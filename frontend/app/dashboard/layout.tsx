"use client";

import { useAuthStore } from "../../store/authStore";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, API_BASE } from "../../lib/api";
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
  Search,
  HelpCircle,
  Sun,
  Moon,
  Laptop,
  Layers,
  FileText,
  Users,
  BarChart2,
  Sliders,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeft,
  Sparkles,
  ShieldAlert,
  ChevronRight
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("light");
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState<string>("exams");
  
  // Notification Center State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifOpen, setNotifOpen] = useState<boolean>(false);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await apiFetch("/notifications/?limit=10", { token });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
      const countRes = await apiFetch("/notifications/unread-count", { token });
      if (countRes.ok) {
        const cData = await countRes.json();
        setUnreadCount(cData.count || 0);
      }
    } catch {}
  };

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { token, method: "POST" });
      fetchNotifications();
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await apiFetch("/notifications/read-all", { token, method: "POST" });
      fetchNotifications();
    } catch {}
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      useAuthStore.getState().syncFromStorage();
      const savedCollapsed = localStorage.getItem("sidebar_collapsed");
      if (savedCollapsed !== null) {
        setSidebarCollapsed(savedCollapsed === "true");
      }
    }
    setMounted(true);
    const saved = localStorage.getItem("theme_mode") as "light" | "dark" | "system" | null;
    const mode = saved || "light";
    setThemeMode(mode);
    applyTheme(mode);
    
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, [token]);

  const applyTheme = (mode: "light" | "dark" | "system") => {
    let isDark = false;
    if (mode === "system") {
      isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    } else {
      isDark = mode === "dark";
    }

    if (isDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("theme", "light");
    }
  };

  const handleThemeChange = (nextMode: "light" | "dark" | "system") => {
    setThemeMode(nextMode);
    localStorage.setItem("theme_mode", nextMode);
    applyTheme(nextMode);
  };

  const toggleSidebarCollapsed = () => {
    const nextState = !sidebarCollapsed;
    setSidebarCollapsed(nextState);
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar_collapsed", String(nextState));
    }
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (themeMode === "system") {
        applyTheme("system");
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeMode]);

  useEffect(() => {
    if (mounted) {
      const activeToken = token || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
      if (!activeToken) {
        router.replace("/login");
      }
    }
  }, [mounted, token, router]);

  useEffect(() => {
    if (mounted && token && role === "student" && pathname === "/dashboard/teacher") {
      router.push("/dashboard/student");
    }
  }, [mounted, token, role, pathname, router]);

  useEffect(() => {
    const handlePop = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        setCurrentTab(hash);
      } else {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get("tab");
        if (tab) setCurrentTab(tab);
      }
    };
    handlePop();
    window.addEventListener("hashchange", handlePop);
    window.addEventListener("popstate", handlePop);
    return () => {
      window.removeEventListener("hashchange", handlePop);
      window.removeEventListener("popstate", handlePop);
    };
  }, [pathname]);

  const navToTab = (tab: string) => {
    closeSidebarMobile();
    setCurrentTab(tab);
    if (pathname === "/dashboard/teacher") {
      window.location.hash = tab;
      const el = document.getElementById(tab);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      window.dispatchEvent(new CustomEvent("switch-tab", { detail: tab }));
    } else {
      router.push(`/dashboard/teacher#${tab}`);
    }
  };

  const isTeacher = role === "teacher" || role === "inst_admin" || role === "super_admin";

  const closeSidebarMobile = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  // Lock body scroll when mobile sidebar drawer is open
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (sidebarOpen && window.innerWidth < 768) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "";
      }
    }
    return () => {
      if (typeof window !== "undefined") document.body.style.overflow = "";
    };
  }, [sidebarOpen]);



  return (
    <div className="flex h-screen bg-[#FAF8F5] dark:bg-[#0F0E0D] overflow-hidden text-[#242321] dark:text-[#F5F5F4]">
      
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ══════════════════════════════════════════════════════
          SIDEBAR NAVIGATION (Expanded: 260px | Collapsed: 72px)
         ══════════════════════════════════════════════════════ */}
      <aside 
        className={`fixed md:static inset-y-0 left-0 z-50 bg-[#FFFFFF] dark:bg-[#171615] border-r border-[#E5E0D8] dark:border-[#292524] flex flex-col shrink-0 transition-all duration-300 ease-in-out shadow-sm md:shadow-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${sidebarCollapsed ? "w-[72px]" : "w-64"}`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-[#E5E0D8] dark:border-[#292524] flex items-center justify-between shrink-0 bg-[#FFFFFF] dark:bg-[#171615]">
          <div className={`flex items-center gap-3 overflow-hidden ${sidebarCollapsed ? "justify-center w-full" : ""}`}>
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#C84B18] to-[#EA580C] text-white flex items-center justify-center shadow-md shadow-[#C84B18]/20 shrink-0">
              <School className="h-5 w-5" />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-extrabold text-sm text-[#242321] dark:text-[#F5F5F4] tracking-tight truncate">EduQuizX</h1>
                  <span className="px-1.5 py-0.2 text-[9px] font-bold bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] rounded">PRO</span>
                </div>
                <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E] mt-0.5 font-medium truncate">Academic Studio</p>
              </div>
            )}
          </div>
          
          {!sidebarCollapsed && (
            <button 
              onClick={toggleSidebarCollapsed}
              className="hidden md:flex p-1.5 rounded-lg text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] hover:bg-[#F7F4EF] dark:hover:bg-[#201D1A] transition-colors cursor-pointer"
              title="Collapse Sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}

          {/* Mobile Close Button */}
          <button 
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-[#716D67] hover:text-[#242321] hover:bg-[#F7F4EF] dark:hover:bg-[#201D1A] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Collapsed Mode Expand Button */}
        {sidebarCollapsed && (
          <div className="hidden md:flex justify-center pt-2 pb-1 border-b border-[#E5E0D8] dark:border-[#292524]">
            <button
              onClick={toggleSidebarCollapsed}
              className="p-1.5 rounded-lg text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] hover:bg-[#F7F4EF] dark:hover:bg-[#201D1A] transition-colors cursor-pointer"
              title="Expand Sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        )}
        
        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto overflow-x-hidden">
          {/* SECTION: CREATOR STUDIO OR STUDENT PORTAL */}
          <div className="space-y-1.5">
            {!sidebarCollapsed ? (
              <div className="text-[10px] font-bold text-[#8C827A] dark:text-[#8C827A] px-3 mb-2 uppercase tracking-widest">
                {pathname === "/dashboard/teacher" ? "Creator Studio" : "Student Portal"}
              </div>
            ) : (
              <div className="w-6 h-0.5 bg-[#E5E0D8] dark:bg-[#292524] mx-auto mb-2 rounded" />
            )}

            <div className="space-y-1">
              {pathname === "/dashboard/teacher" ? (
                <>
                  {/* Assessments Tab */}
                  <button 
                    onClick={() => navToTab("exams")}
                    className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      sidebarCollapsed ? "justify-center px-0" : ""
                    } ${
                      currentTab === "exams"
                        ? "bg-[#C84B18] text-white shadow-sm shadow-[#C84B18]/25"
                        : "text-[#57534E] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] hover:bg-[#F7F4EF] dark:hover:bg-[#201D1A]"
                    }`}
                  >
                    <GraduationCap className={`h-4.5 w-4.5 shrink-0 ${currentTab === "exams" ? "text-white" : "text-[#716D67] group-hover:text-[#C84B18]"}`} />
                    {!sidebarCollapsed && <span>Assessments</span>}
                    {sidebarCollapsed && (
                      <span className="absolute left-full ml-3 px-2.5 py-1 bg-[#1F1E1D] text-white text-xs font-medium rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50">
                        Assessments
                      </span>
                    )}
                  </button>

                  {/* Create Quiz Tab */}
                  <button 
                    onClick={() => navToTab("create")}
                    className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      sidebarCollapsed ? "justify-center px-0" : ""
                    } ${
                      currentTab === "create"
                        ? "bg-[#C84B18] text-white shadow-sm shadow-[#C84B18]/25"
                        : "text-[#57534E] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] hover:bg-[#F7F4EF] dark:hover:bg-[#201D1A]"
                    }`}
                  >
                    <FileText className={`h-4.5 w-4.5 shrink-0 ${currentTab === "create" ? "text-white" : "text-[#716D67] group-hover:text-[#C84B18]"}`} />
                    {!sidebarCollapsed && <span>Create Quiz</span>}
                    {sidebarCollapsed && (
                      <span className="absolute left-full ml-3 px-2.5 py-1 bg-[#1F1E1D] text-white text-xs font-medium rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50">
                        Create Quiz Wizard
                      </span>
                    )}
                  </button>

                  {/* Question Bank Tab */}
                  <button 
                    onClick={() => navToTab("bank")}
                    className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      sidebarCollapsed ? "justify-center px-0" : ""
                    } ${
                      currentTab === "bank"
                        ? "bg-[#C84B18] text-white shadow-sm shadow-[#C84B18]/25"
                        : "text-[#57534E] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] hover:bg-[#F7F4EF] dark:hover:bg-[#201D1A]"
                    }`}
                  >
                    <Layers className={`h-4.5 w-4.5 shrink-0 ${currentTab === "bank" ? "text-white" : "text-[#716D67] group-hover:text-[#C84B18]"}`} />
                    {!sidebarCollapsed && <span>Question Bank</span>}
                    {sidebarCollapsed && (
                      <span className="absolute left-full ml-3 px-2.5 py-1 bg-[#1F1E1D] text-white text-xs font-medium rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50">
                        Question Bank
                      </span>
                    )}
                  </button>

                  {/* Knowledge Base Tab */}
                  <button 
                    onClick={() => navToTab("kb")}
                    className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      sidebarCollapsed ? "justify-center px-0" : ""
                    } ${
                      currentTab === "kb"
                        ? "bg-[#C84B18] text-white shadow-sm shadow-[#C84B18]/25"
                        : "text-[#57534E] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] hover:bg-[#F7F4EF] dark:hover:bg-[#201D1A]"
                    }`}
                  >
                    <BookOpen className={`h-4.5 w-4.5 shrink-0 ${currentTab === "kb" ? "text-white" : "text-[#716D67] group-hover:text-[#C84B18]"}`} />
                    {!sidebarCollapsed && <span>Knowledge Base</span>}
                    {sidebarCollapsed && (
                      <span className="absolute left-full ml-3 px-2.5 py-1 bg-[#1F1E1D] text-white text-xs font-medium rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50">
                        Knowledge Base (RAG)
                      </span>
                    )}
                  </button>

                  {/* Student Directory Tab */}
                  <button 
                    onClick={() => navToTab("students")}
                    className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      sidebarCollapsed ? "justify-center px-0" : ""
                    } ${
                      currentTab === "students"
                        ? "bg-[#C84B18] text-white shadow-sm shadow-[#C84B18]/25"
                        : "text-[#57534E] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] hover:bg-[#F7F4EF] dark:hover:bg-[#201D1A]"
                    }`}
                  >
                    <Users className={`h-4.5 w-4.5 shrink-0 ${currentTab === "students" ? "text-white" : "text-[#716D67] group-hover:text-[#C84B18]"}`} />
                    {!sidebarCollapsed && <span>Student Directory</span>}
                    {sidebarCollapsed && (
                      <span className="absolute left-full ml-3 px-2.5 py-1 bg-[#1F1E1D] text-white text-xs font-medium rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50">
                        Student Directories & Cohorts
                      </span>
                    )}
                  </button>
                </>
              ) : (
                <a
                  href="/dashboard/student"
                  onClick={closeSidebarMobile}
                  className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] border border-[#C84B18]/20 transition-all ${
                    sidebarCollapsed ? "justify-center px-0" : ""
                  }`}
                >
                  <UserCheck className="h-4.5 w-4.5 shrink-0" />
                  {!sidebarCollapsed && <span>Student Portal</span>}
                  {sidebarCollapsed && (
                    <span className="absolute left-full ml-3 px-2.5 py-1 bg-[#1F1E1D] text-white text-xs font-medium rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50">
                      Student Exam Portal
                    </span>
                  )}
                </a>
              )}
            </div>
          </div>

          {/* SECTION: ANALYTICS (Creator Mode Only) */}
          {pathname === "/dashboard/teacher" && (
            <div className="space-y-1.5">
              {!sidebarCollapsed ? (
                <div className="text-[10px] font-bold text-[#8C827A] dark:text-[#8C827A] px-3 mb-2 uppercase tracking-widest">
                  Analytics & Reports
                </div>
              ) : (
                <div className="w-6 h-0.5 bg-[#E5E0D8] dark:bg-[#292524] mx-auto mb-2 rounded" />
              )}
              
              <div className="space-y-1">
                <button 
                  onClick={() => navToTab("reports")}
                  className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    sidebarCollapsed ? "justify-center px-0" : ""
                  } ${
                    currentTab === "reports"
                      ? "bg-[#C84B18] text-white shadow-sm shadow-[#C84B18]/25"
                      : "text-[#57534E] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] hover:bg-[#F7F4EF] dark:hover:bg-[#201D1A]"
                  }`}
                >
                  <BarChart2 className={`h-4.5 w-4.5 shrink-0 ${currentTab === "reports" ? "text-white" : "text-[#716D67] group-hover:text-[#C84B18]"}`} />
                  {!sidebarCollapsed && <span>Results & Gradebook</span>}
                  {sidebarCollapsed && (
                    <span className="absolute left-full ml-3 px-2.5 py-1 bg-[#1F1E1D] text-white text-xs font-medium rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50">
                      Results & Gradebook Analytics
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* SECTION: SYSTEM & PREFERENCES */}
          <div className="space-y-1.5">
            {!sidebarCollapsed ? (
              <div className="text-[10px] font-bold text-[#8C827A] dark:text-[#8C827A] px-3 mb-2 uppercase tracking-widest">
                Preferences
              </div>
            ) : (
              <div className="w-6 h-0.5 bg-[#E5E0D8] dark:bg-[#292524] mx-auto mb-2 rounded" />
            )}

            <div className="space-y-1">
              <button 
                onClick={() => { closeSidebarMobile(); setSettingsModalOpen(true); }}
                className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-[#57534E] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] hover:bg-[#F7F4EF] dark:hover:bg-[#201D1A] transition-all cursor-pointer ${
                  sidebarCollapsed ? "justify-center px-0" : ""
                }`}
              >
                <Sliders className="h-4.5 w-4.5 shrink-0 text-[#716D67] group-hover:text-[#C84B18]" />
                {!sidebarCollapsed && <span>Settings & Profile</span>}
                {sidebarCollapsed && (
                  <span className="absolute left-full ml-3 px-2.5 py-1 bg-[#1F1E1D] text-white text-xs font-medium rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50">
                    System & Profile Settings
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* SECTION: DEVELOPER TOOLS (Collapsible) */}
          <div className="pt-2 border-t border-[#E5E0D8] dark:border-[#292524]">
            <button 
              onClick={() => setDevToolsOpen(!devToolsOpen)} 
              className={`w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] rounded-lg hover:bg-[#F7F4EF] dark:hover:bg-[#201D1A] transition-colors cursor-pointer ${
                sidebarCollapsed ? "justify-center px-0" : ""
              }`}
              title="Developer Tools"
            >
              {!sidebarCollapsed ? (
                <>
                  <div className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5" />
                    <span>Developer Sandbox</span>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${devToolsOpen ? "rotate-180" : ""}`} />
                </>
              ) : (
                <div className="group relative">
                  <Layers className="h-4 w-4" />
                  <span className="absolute left-full ml-3 px-2.5 py-1 bg-[#1F1E1D] text-white text-xs font-medium rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50">
                    Developer Tools
                  </span>
                </div>
              )}
            </button>

            {devToolsOpen && !sidebarCollapsed && (
              <div className="mt-1 space-y-1 pl-4 border-l border-[#E5E0D8] dark:border-[#292524] ml-3 text-[11px]">
                <a 
                  href={`${API_BASE}/static/index.html`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center justify-between px-2 py-1 text-[#716D67] dark:text-[#A8A29E] hover:text-[#C84B18] rounded transition-colors"
                >
                  <span>Static Creator UI</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a 
                  href={`${API_BASE}/static/exam.html`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center justify-between px-2 py-1 text-[#716D67] dark:text-[#A8A29E] hover:text-[#C84B18] rounded transition-colors"
                >
                  <span>Candidate Sandbox</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a 
                  href={`${API_BASE}/docs`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center justify-between px-2 py-1 text-[#716D67] dark:text-[#A8A29E] hover:text-[#C84B18] rounded transition-colors"
                >
                  <span>FastAPI Swagger Docs</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </nav>

        {/* ══════════════════════════════════════════════════════
            BOTTOM PROFILE & LOGOUT CARD
           ══════════════════════════════════════════════════════ */}
        <div className="p-3 border-t border-[#E5E0D8] dark:border-[#292524] bg-[#FAF8F5] dark:bg-[#141312] shrink-0">
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? "flex-col justify-center" : "justify-between"}`}>
            <div className={`flex items-center gap-2.5 overflow-hidden ${sidebarCollapsed ? "justify-center" : ""}`}>
              <div 
                className="h-9 w-9 rounded-xl bg-[#C84B18] dark:bg-[#EA580C] text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0 cursor-pointer"
                title={fullName || "User Account"}
              >
                {fullName ? fullName.charAt(0).toUpperCase() : "T"}
              </div>
              {!sidebarCollapsed && (
                <div className="overflow-hidden">
                  <div className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4] truncate">
                    {fullName || "Dr. Sarah Jenkins"}
                  </div>
                  <div className="text-[10px] text-[#716D67] dark:text-[#A8A29E] font-medium capitalize truncate">
                    {role || "Teacher"} · EduQuizX
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={() => { logout(); router.push("/login"); }}
              className={`p-2 rounded-xl text-[#716D67] dark:text-[#A8A29E] hover:text-red-500 hover:bg-[#F0ECE4] dark:hover:bg-[#201D1A] transition-colors cursor-pointer ${
                sidebarCollapsed ? "mt-1" : ""
              }`}
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════
          MAIN CONTENT AREA & TOPBAR
         ══════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top App Navigation Header */}
        <header className="h-16 border-b border-[#E5E0D8] dark:border-[#292524] bg-[#FFFFFF] dark:bg-[#171615] px-4 md:px-6 flex items-center justify-between shrink-0 shadow-xs">
          
          {/* Left Breadcrumb & Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl text-[#716D67] hover:text-[#242321] hover:bg-[#FAF8F5] dark:hover:bg-[#201D1A] cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-[#716D67] dark:text-[#A8A29E] min-w-0">
              <span className="hidden sm:inline font-medium">EduQuizX</span>
              <span className="hidden sm:inline">/</span>
              <span className="font-bold text-[#242321] dark:text-[#F5F5F4] truncate max-w-[120px] sm:max-w-none">
                {pathname === "/dashboard/teacher" ? "Creator Studio" : "Student Portal"}
              </span>
              <a 
                href="/" 
                className="ml-2 hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] hover:bg-[#C84B18]/20 text-xs font-semibold transition-all border border-[#C84B18]/20"
                title="Switch Workspace Mode"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Switch Mode</span>
              </a>
            </div>
          </div>

          {/* Center Search Input */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#716D67] dark:text-[#A8A29E]" />
              <input 
                type="text" 
                placeholder="Search assessments, candidate cohorts, questions..." 
                className="w-full bg-[#FAF8F5] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl pl-9 pr-4 py-2 text-xs text-[#242321] dark:text-[#F5F5F4] placeholder-[#716D67] dark:placeholder-[#A8A29E] focus:outline-none focus:ring-1 focus:ring-[#C84B18] transition-all"
              />
            </div>
          </div>

          {/* Right Action Menu: Help, Notifications, Theme Toggle */}
          <div className="flex items-center gap-2.5">
            <a 
              href="/guide"
              className="p-2 rounded-xl text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] hover:bg-[#FAF8F5] dark:hover:bg-[#201D1A] transition-colors"
              title="Documentation Guide"
            >
              <HelpCircle className="h-4.5 w-4.5" />
            </a>

            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-2 rounded-xl text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] hover:bg-[#FAF8F5] dark:hover:bg-[#201D1A] relative transition-colors cursor-pointer" 
                title="Notifications"
              >
                <Bell className="h-4.5 w-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute 1 top-1 right-1 h-4 w-4 rounded-full bg-[#C84B18] text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Flyout */}
              {notifOpen && (
                <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 top-16 sm:top-auto sm:mt-2 w-auto sm:w-96 bg-white dark:bg-[#1C1A17] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in duration-200">
                  <div className="p-3.5 border-b border-[#E5E0D8] dark:border-[#292524] flex items-center justify-between bg-[#FAF8F5] dark:bg-[#141312]">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-[#C84B18]" />
                      <span className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4]">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] bg-[#C84B18]/10 text-[#C84B18] px-2 py-0.5 rounded-full font-bold">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllRead}
                        className="text-[11px] text-[#C84B18] hover:underline font-semibold cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-[#E5E0D8]/60 dark:divide-[#292524]">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#716D67] dark:text-[#A8A29E]">
                        <Bell className="h-6 w-6 mx-auto mb-2 opacity-30" />
                        <span>No new notifications</span>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div 
                          key={n.id} 
                          className={`p-3.5 text-xs transition-all hover:bg-[#FAF8F5] dark:hover:bg-[#201D1A] flex items-start justify-between gap-2.5 ${
                            !n.is_read ? "bg-[#C84B18]/5 dark:bg-[#EA580C]/10 font-medium" : ""
                          }`}
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-[#242321] dark:text-[#F5F5F4]">{n.title}</span>
                              <span className="text-[10px] text-[#716D67] dark:text-[#A8A29E]">
                                {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E] leading-relaxed">{n.message}</p>
                            {n.link && (
                              <a 
                                href={n.link}
                                onClick={() => { markRead(n.id); setNotifOpen(false); }}
                                className="inline-flex items-center gap-1 text-[11px] text-[#C84B18] hover:underline font-medium mt-1"
                              >
                                View details &rarr;
                              </a>
                            )}
                          </div>
                          {!n.is_read && (
                            <button 
                              onClick={() => markRead(n.id)}
                              className="h-2 w-2 rounded-full bg-[#C84B18] hover:scale-125 transition-all shrink-0 mt-1.5 cursor-pointer"
                              title="Mark read"
                            />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle (Light / Dark / System) */}
            <div className="flex items-center bg-[#FAF8F5] dark:bg-[#141312] p-1 rounded-xl text-[11px] font-semibold border border-[#E5E0D8] dark:border-[#292524]">
              <button 
                type="button"
                onClick={() => handleThemeChange("light")}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  themeMode === "light" 
                    ? "bg-white text-[#242321] shadow-xs" 
                    : "text-[#716D67] hover:text-[#242321]"
                }`}
                title="Light Mode"
              >
                <Sun className="h-3.5 w-3.5 text-amber-500" />
                <span className="hidden sm:inline">Light</span>
              </button>
              <button 
                type="button"
                onClick={() => handleThemeChange("dark")}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  themeMode === "dark" 
                    ? "bg-[#24211E] text-[#F5F5F4] shadow-xs" 
                    : "text-[#716D67] hover:text-[#F5F5F4]"
                }`}
                title="Dark Mode"
              >
                <Moon className="h-3.5 w-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Dark</span>
              </button>
              <button 
                type="button"
                onClick={() => handleThemeChange("system")}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  themeMode === "system" 
                    ? "bg-white dark:bg-[#24211E] text-[#242321] dark:text-[#F5F5F4] shadow-xs" 
                    : "text-[#716D67] hover:text-[#242321]"
                }`}
                title="System Theme"
              >
                <Laptop className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">System</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#FAF8F5] dark:bg-[#0F0E0D]">
          {children}
        </main>
      </div>

      {/* ══════════════════════════════════════════════════════
          SETTINGS MODAL
         ══════════════════════════════════════════════════════ */}
      {settingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] rounded-xl border border-[#C84B18]/20">
                  <Sliders className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">System & Profile Settings</h3>
                  <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">Workspace and account preferences</p>
                </div>
              </div>
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="p-1.5 rounded-lg text-[#716D67] hover:bg-[#F0ECE4] dark:hover:bg-[#201D1A] transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5 p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524]">
                <div className="font-bold text-sm text-[#242321] dark:text-[#F5F5F4]">{fullName || "Dr. Sarah Jenkins"}</div>
                <div className="text-[11px] text-[#716D67] dark:text-[#A8A29E] font-medium">Role: <span className="font-bold text-[#C84B18] uppercase">{role || "TEACHER"}</span></div>
                <div className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">Institution: EduQuizX Academy</div>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-[#242321] dark:text-[#F5F5F4] uppercase tracking-wider text-[10px]">Theme Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["light", "dark", "system"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleThemeChange(mode)}
                      className={`p-2.5 rounded-xl border text-center font-semibold capitalize transition-all cursor-pointer ${
                        themeMode === mode
                          ? "bg-[#C84B18]/10 border-[#C84B18] text-[#C84B18] dark:bg-[#EA580C]/15 dark:border-[#EA580C] dark:text-[#EA580C] shadow-xs"
                          : "border-[#E5E0D8] dark:border-[#292524] bg-[#FAF8F5] dark:bg-[#141312] text-[#716D67] hover:text-[#242321]"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#E5E0D8] dark:border-[#292524] flex justify-between items-center">
                <button
                  onClick={() => { logout(); router.push("/login"); }}
                  className="px-4 py-2 rounded-xl text-red-600 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold cursor-pointer transition-colors"
                >
                  Sign Out
                </button>
                <button
                  onClick={() => setSettingsModalOpen(false)}
                  className="px-5 py-2 bg-[#C84B18] hover:bg-[#B33F12] text-white font-semibold rounded-xl shadow-sm cursor-pointer transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

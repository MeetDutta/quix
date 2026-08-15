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
  ArrowLeft
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
    if (mounted && !token) {
      router.replace("/");
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
      window.dispatchEvent(new CustomEvent("switch-tab", { detail: tab }));
    } else {
      router.push(`/dashboard/teacher#${tab}`);
    }
  };

  const isTeacher = role === "teacher" || role === "inst_admin" || role === "super_admin";

  const closeSidebarMobile = () => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex h-screen bg-[#F7F4EF] dark:bg-[#0F0E0D] items-center justify-center text-[#716D67] text-sm">
        <div className="flex items-center gap-3 bg-white dark:bg-[#171615] px-5 py-3.5 rounded-lg border border-[#E5E0D8] dark:border-[#292524]">
          <div className="w-4 h-4 rounded-full border-2 border-[#C84B18] dark:border-[#EA580C] border-t-transparent animate-spin" />
          <span className="font-medium text-[#242321] dark:text-[#F5F5F4]">Loading EduQuizX...</span>
        </div>
      </div>
    );
  }

  if (!token) {
    return null;
  }

  return (
    <div className="flex h-screen bg-[#F7F4EF] dark:bg-[#0F0E0D] overflow-hidden text-[#242321] dark:text-[#F5F5F4]">
      
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation (Responsive Collapsible ~260px / 64px) */}
      <aside 
        className={`fixed md:static inset-y-0 left-0 z-50 bg-[#F0ECE4] dark:bg-[#171615] border-r border-[#E5E0D8] dark:border-[#292524] flex flex-col shrink-0 transform transition-all duration-200 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${sidebarCollapsed ? "md:w-16 w-64" : "md:w-64 w-64"}`}
      >
        {/* Brand Header */}
        <div className="h-14 px-3 border-b border-[#E5E0D8] dark:border-[#292524] flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="p-1.5 rounded-md bg-[#C84B18] dark:bg-[#EA580C] text-white shrink-0">
              <School className="h-4.5 w-4.5" />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <h1 className="font-bold text-sm text-[#242321] dark:text-[#F5F5F4] leading-none truncate">EduQuizX</h1>
                <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E] mt-0.5 truncate">Classroom Assessment</p>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {/* Desktop Collapse Toggle */}
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:flex p-1.5 rounded text-[#716D67] hover:text-[#242321] hover:bg-[#E5E0D8]/60 dark:hover:bg-[#292524]"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            {/* Mobile Close Button */}
            <button 
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1 rounded text-[#716D67] hover:text-[#242321]"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
        
        {/* Nav Sections */}
        <nav className="flex-1 px-2 py-4 space-y-5 overflow-y-auto">
          {/* WORKSPACE */}
          <div>
            {!sidebarCollapsed && (
              <div className="text-[10px] font-semibold text-[#716D67] dark:text-[#A8A29E] px-2 mb-1.5 uppercase tracking-wider">
                {pathname === "/dashboard/teacher" ? "Creator Studio" : "Student Portal"}
              </div>
            )}
            <div className="space-y-0.5">
              {pathname === "/dashboard/teacher" ? (
                <>
                  <button 
                    onClick={() => navToTab("exams")}
                    title="Assessments & Quizzes"
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-all ${
                      currentTab === "exams"
                        ? "bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C]"
                        : "text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] hover:bg-[#E5E0D8]/50 dark:hover:bg-[#292524]/50"
                    }`}
                  >
                    <GraduationCap className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed && <span>Assessments</span>}
                  </button>

                  <button 
                    onClick={() => navToTab("create")}
                    title="Create Assessment Wizard"
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-all ${
                      currentTab === "create"
                        ? "bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C]"
                        : "text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] hover:bg-[#E5E0D8]/50 dark:hover:bg-[#292524]/50"
                    }`}
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed && <span>Create Quiz</span>}
                  </button>

                  <button 
                    onClick={() => navToTab("bank")}
                    title="Question Bank Library"
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-all ${
                      currentTab === "bank"
                        ? "bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C]"
                        : "text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] hover:bg-[#E5E0D8]/50 dark:hover:bg-[#292524]/50"
                    }`}
                  >
                    <Layers className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed && <span>Question Bank</span>}
                  </button>

                  <button 
                    onClick={() => navToTab("kb")}
                    title="Knowledge Base"
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-all ${
                      currentTab === "kb"
                        ? "bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C]"
                        : "text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] hover:bg-[#E5E0D8]/50 dark:hover:bg-[#292524]/50"
                    }`}
                  >
                    <BookOpen className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed && <span>Knowledge Base</span>}
                  </button>

                  <button 
                    onClick={() => navToTab("students")}
                    title="Student Directory"
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-all ${
                      currentTab === "students"
                        ? "bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C]"
                        : "text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] hover:bg-[#E5E0D8]/50 dark:hover:bg-[#292524]/50"
                    }`}
                  >
                    <Users className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed && <span>Student Directory</span>}
                  </button>
                </>
              ) : (
                <a
                  href="/dashboard/student"
                  onClick={closeSidebarMobile}
                  title="Student Portal"
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60"
                >
                  <UserCheck className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && <span>Student Exam Portal</span>}
                </a>
              )}
            </div>
          </div>

          {/* ANALYTICS (Creator Mode Only) */}
          {pathname === "/dashboard/teacher" && (
            <div>
              {!sidebarCollapsed && (
                <div className="text-[10px] font-semibold text-[#716D67] dark:text-[#A8A29E] px-2 mb-1.5 uppercase tracking-wider">
                  Analytics
                </div>
              )}
              <div className="space-y-0.5">
                <button 
                  onClick={() => navToTab("reports")}
                  title="Results & Reports"
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-all ${
                    currentTab === "reports"
                      ? "bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C]"
                      : "text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] hover:bg-[#E5E0D8]/50 dark:hover:bg-[#292524]/50"
                  }`}
                >
                  <BarChart2 className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && <span>Results & Gradebook</span>}
                </button>
              </div>
            </div>
          )}

          {/* SETTINGS */}
          <div>
            {!sidebarCollapsed && (
              <div className="text-[10px] font-semibold text-[#716D67] dark:text-[#A8A29E] px-2 mb-1.5 uppercase tracking-wider">
                Settings
              </div>
            )}
            <div className="space-y-0.5">
              <button 
                onClick={() => { closeSidebarMobile(); setSettingsModalOpen(true); }}
                title="System Settings"
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-[#F5F5F4] hover:bg-[#E5E0D8]/50 dark:hover:bg-[#292524]/50 transition-all"
              >
                <Sliders className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span>Settings</span>}
              </button>
            </div>
          </div>

          {/* INTERNAL DEV TOOLS (Collapsible) */}
          <div className="pt-2 border-t border-[#E5E0D8] dark:border-[#292524]">
            <button 
              onClick={() => setDevToolsOpen(!devToolsOpen)} 
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-semibold text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321]"
              title="Developer Tools"
            >
              {!sidebarCollapsed ? <span>Developer Tools</span> : <Layers className="h-4 w-4 shrink-0" />}
              {!sidebarCollapsed && <ChevronDown className={`h-3.5 w-3.5 transition-transform ${devToolsOpen ? "rotate-180" : ""}`} />}
            </button>

            {devToolsOpen && !sidebarCollapsed && (
              <div className="mt-1 space-y-0.5 pl-2 border-l border-[#E5E0D8] dark:border-[#292524]">
                <a 
                  href={`${API_BASE}/static/index.html`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center justify-between px-2 py-1 text-[11px] text-[#716D67] hover:text-[#C84B18]"
                >
                  <span>Static Creator HTML</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a 
                  href={`${API_BASE}/static/exam.html`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center justify-between px-2 py-1 text-[11px] text-[#716D67] hover:text-[#C84B18]"
                >
                  <span>Student Exam Gateway</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </nav>

        {/* Bottom Profile Card */}
        <div className="p-3 border-t border-[#E5E0D8] dark:border-[#292524] bg-[#EAE5DC] dark:bg-[#1D1B19] flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-8 w-8 rounded-md bg-[#C84B18] dark:bg-[#EA580C] text-white flex items-center justify-center font-bold text-xs shrink-0">
              {fullName ? fullName[0] : "S"}
            </div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <div className="text-xs font-medium text-[#242321] dark:text-[#F5F5F4] truncate">{fullName || "Dr. Sarah Jenkins"}</div>
                <div className="text-[11px] text-[#716D67] dark:text-[#A8A29E] capitalize">{role || "Teacher"}</div>
              </div>
            )}
          </div>
          <button 
            onClick={() => { logout(); router.push("/"); }}
            className="p-1.5 rounded text-[#716D67] hover:text-[#C84B18] hover:bg-[#E5E0D8]/60 dark:hover:bg-[#292524]"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top App Navigation Header */}
        <header className="h-14 border-b border-[#E5E0D8] dark:border-[#292524] bg-[#F7F4EF] dark:bg-[#0F0E0D] px-4 md:px-6 flex items-center justify-between shrink-0">
          
          {/* Left Breadcrumb & Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1.5 rounded text-[#716D67] hover:text-[#242321]"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 text-xs text-[#716D67] dark:text-[#A8A29E]">
              <span>EduQuizX</span>
              <span>/</span>
              <span className="font-semibold text-[#242321] dark:text-[#F5F5F4]">
                {pathname === "/dashboard/teacher" ? "Quiz Creator" : "Student Portal"}
              </span>
              <a 
                href="/portal" 
                className="ml-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] hover:bg-[#C84B18]/20 text-xs font-bold transition-all border border-[#C84B18]/20"
                title="Switch Workspace Mode"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Switch Workspace</span>
              </a>
            </div>
          </div>

          {/* Center Search Input */}
          <div className="hidden sm:flex items-center flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#716D67] dark:text-[#A8A29E]" />
              <input 
                type="text" 
                placeholder="Search assessments, students, questions..." 
                className="w-full bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-md pl-9 pr-3 py-1.5 text-xs text-[#242321] dark:text-[#F5F5F4] placeholder-[#716D67] dark:placeholder-[#A8A29E] focus:outline-none focus:border-[#C84B18] transition-all"
              />
            </div>
          </div>

          {/* Right Action Menu: Help, Notifications, Theme Toggle, Profile */}
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded text-[#716D67] hover:text-[#242321] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524]" title="Help & Documentation">
              <HelpCircle className="h-4 w-4" />
            </button>
            <div className="relative">
              <button 
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-1.5 rounded text-[#716D67] hover:text-[#242321] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] relative" 
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-[#C84B18] text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Flyout Dropdown */}
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#1C1A17] border border-[#E5E0D8] dark:border-[#292524] rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-[#E5E0D8] dark:border-[#292524] flex items-center justify-between bg-[#F7F4EF] dark:bg-[#141312]">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-[#C84B18]" />
                      <span className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4]">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] bg-[#C84B18]/10 text-[#C84B18] px-1.5 py-0.5 rounded font-semibold">
                          {unreadCount} unread
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllRead}
                        className="text-[11px] text-[#C84B18] hover:underline font-medium"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-[#E5E0D8]/50 dark:divide-[#292524]">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#716D67] dark:text-[#A8A29E]">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div 
                          key={n.id} 
                          className={`p-3 text-xs transition-all hover:bg-[#F7F4EF]/60 dark:hover:bg-[#24211D] flex items-start justify-between gap-2 ${
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
                              className="h-2 w-2 rounded-full bg-[#C84B18] hover:scale-125 transition-all shrink-0 mt-1"
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
            <div className="flex items-center bg-[#E5E0D8]/60 dark:bg-[#292524] p-0.5 rounded-md text-[11px] font-medium border border-[#E5E0D8] dark:border-[#292524]">
              <button 
                type="button"
                onClick={() => handleThemeChange("light")}
                className={`px-2 py-1 rounded flex items-center gap-1 transition-all ${
                  themeMode === "light" 
                    ? "bg-white text-[#242321] shadow-xs" 
                    : "text-[#716D67] hover:text-[#242321]"
                }`}
                title="Light Mode"
              >
                <Sun className="h-3 w-3" />
                <span className="hidden lg:inline">Light</span>
              </button>
              <button 
                type="button"
                onClick={() => handleThemeChange("dark")}
                className={`px-2 py-1 rounded flex items-center gap-1 transition-all ${
                  themeMode === "dark" 
                    ? "bg-[#171615] text-[#F5F5F4] shadow-xs" 
                    : "text-[#716D67] hover:text-[#F5F5F4]"
                }`}
                title="Dark Mode"
              >
                <Moon className="h-3 w-3" />
                <span className="hidden lg:inline">Dark</span>
              </button>
              <button 
                type="button"
                onClick={() => handleThemeChange("system")}
                className={`px-2 py-1 rounded flex items-center gap-1 transition-all ${
                  themeMode === "system" 
                    ? "bg-white dark:bg-[#171615] text-[#242321] dark:text-[#F5F5F4] shadow-xs" 
                    : "text-[#716D67] hover:text-[#242321]"
                }`}
                title="System Theme"
              >
                <Laptop className="h-3 w-3" />
                <span className="hidden lg:inline">System</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F7F4EF] dark:bg-[#0F0E0D]">
          {children}
        </main>
      </div>

      {/* ═══════ SETTINGS MODAL ═══════ */}
      {settingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] rounded-md">
                  <Sliders className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#242321] dark:text-[#F5F5F4]">System & Profile Settings</h3>
                  <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">Workspace and account preferences</p>
                </div>
              </div>
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="p-1.5 rounded-md text-[#716D67] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1 p-3 rounded-lg bg-[#F0ECE4]/50 dark:bg-[#1D1B19]/50 border border-[#E5E0D8] dark:border-[#292524]">
                <div className="font-semibold text-[#242321] dark:text-[#F5F5F4]">{fullName || "User"}</div>
                <div className="text-[11px] text-[#716D67] dark:text-[#A8A29E] font-mono">Role: {role?.toUpperCase() || "STAFF"}</div>
                <div className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">Institution: EduQuizX Academy</div>
              </div>

              <div className="space-y-2">
                <label className="font-semibold text-[#242321] dark:text-[#F5F5F4]">Theme Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["light", "dark", "system"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleThemeChange(mode)}
                      className={`p-2 rounded-md border text-center font-medium capitalize transition-all ${
                        themeMode === mode
                          ? "bg-[#C84B18]/10 border-[#C84B18] text-[#C84B18] dark:bg-[#EA580C]/15 dark:border-[#EA580C] dark:text-[#EA580C]"
                          : "border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321]"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#E5E0D8] dark:border-[#292524] flex justify-between items-center">
                <button
                  onClick={() => { logout(); router.push("/"); }}
                  className="px-3 py-1.5 rounded-md text-rose-600 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium"
                >
                  Sign Out
                </button>
                <button
                  onClick={() => setSettingsModalOpen(false)}
                  className="btn-primary"
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

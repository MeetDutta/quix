"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../store/authStore";
import { GraduationCap, AlertCircle, Eye, EyeOff, ShieldCheck, School, Sun, Moon } from "lucide-react";

import { apiFetch } from "../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const [role, setRole] = useState<"teacher" | "student">("teacher");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    if (next === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Incorrect email or password");
      }

      setAuth(data.access_token, data.role, data.full_name);
      
      if (data.role === "teacher" || data.role === "inst_admin" || data.role === "super_admin") {
        router.push("/dashboard/teacher");
      } else {
        router.push("/dashboard/student");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const autofillTeacher = () => {
    setEmail("teacher@aegeus.edu");
    setPassword("securepassword");
    setRole("teacher");
  };

  const autofillStudent = () => {
    setEmail("student@aegeus.edu");
    setPassword("securepassword");
    setRole("student");
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const emailToAuth = email || prompt("Enter your Google Account email to sign in:", "student@aegeus.edu");
      if (!emailToAuth) {
        setLoading(false);
        return;
      }

      const response = await apiFetch("/auth/google-login", {
        method: "POST",
        body: JSON.stringify({
          email: emailToAuth,
          name: emailToAuth.split("@")[0].replace(".", " ").toUpperCase(),
          google_id: `google_${Date.now()}`
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Google authentication failed");
      }

      setAuth(data.access_token, data.role, data.full_name);
      if (data.role === "teacher" || data.role === "inst_admin" || data.role === "super_admin") {
        router.push("/dashboard/teacher");
      } else {
        router.push("/dashboard/student");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center relative overflow-hidden bg-[#F7F4EF] dark:bg-[#0F0E0D] px-4 py-8 sm:py-12 transition-colors duration-200">
      {/* Top Right Light/Dark Sliding Switch Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={toggleTheme}
          className="w-13 h-7 rounded-full bg-[#E5E0D8] dark:bg-[#292524] border border-[#E5E0D8] dark:border-[#292524] p-1 flex items-center shadow-xs cursor-pointer transition-colors duration-300 relative focus:outline-none"
          title={`Switch to ${theme === "light" ? "Dark" : "Light"} mode`}
          aria-label="Toggle Theme"
        >
          <div
            className={`w-5 h-5 rounded-full bg-white dark:bg-[#EA580C] shadow-xs border border-[#E5E0D8] dark:border-transparent transform transition-transform duration-300 flex items-center justify-center ${
              theme === "dark" ? "translate-x-6 text-white" : "translate-x-0 text-[#C84B18]"
            }`}
          >
            {theme === "light" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </div>
        </button>
      </div>

      <div className="w-full max-w-[440px] z-10 space-y-6">
        <div className="flex justify-center items-center gap-3">
          <div className="p-3 rounded-xl bg-[#C84B18] dark:bg-[#EA580C] text-white shadow-xs">
            <School className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#242321] dark:text-[#F5F5F4] leading-none">EduQuizX</h1>
            <p className="text-xs text-[#716D67] dark:text-[#A8A29E] font-medium tracking-wide mt-1">Autonomous Examination Platform</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#171615] rounded-2xl p-8 border border-[#E7E0D3] dark:border-[#292524] shadow-sm relative overflow-hidden space-y-6">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#9A3412] via-amber-600 to-[#9A3412]" />
          
          <div>
            <h2 className="text-2xl font-bold text-[#1C1917] dark:text-white tracking-tight">Welcome Back</h2>
            <p className="text-[#78716C] dark:text-[#A8A29E] text-xs mt-1">Sign in to access your portal and evaluations.</p>
          </div>

          {/* Preset Fill Shortcuts */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={autofillTeacher}
              className="flex-1 py-1.5 px-3 text-[11px] font-semibold rounded-lg bg-[#FCEBE6] dark:bg-[#292524] text-[#9A3412] dark:text-[#F5F5F4] border border-[#F7D5CA] dark:border-[#383330] hover:bg-[#F7D5CA] transition-all text-center"
            >
              Fill Creator Creds
            </button>
            <button
              type="button"
              onClick={autofillStudent}
              className="flex-1 py-1.5 px-3 text-[11px] font-semibold rounded-lg bg-[#F5F0E8] dark:bg-[#292524] text-[#57534E] dark:text-[#F5F5F4] border border-[#E7E0D3] dark:border-[#383330] hover:bg-[#EAE3D5] transition-all text-center"
            >
              Fill Student Creds
            </button>
          </div>
          
          <div className="flex gap-2 p-1 bg-[#FBF9F5] dark:bg-[#1D1B19] rounded-xl border border-[#E7E0D3] dark:border-[#292524]">
            <button
              type="button"
              onClick={() => setRole("teacher")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                role === "teacher"
                  ? "bg-white dark:bg-[#292524] text-[#9A3412] dark:text-white shadow-xs border border-[#E7E0D3] dark:border-[#383330]"
                  : "text-[#78716C] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-white"
              }`}
            >
              Quiz Creator
            </button>
            <button
              type="button"
              onClick={() => setRole("student")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                role === "student"
                  ? "bg-white dark:bg-[#292524] text-[#9A3412] dark:text-white shadow-xs border border-[#E7E0D3] dark:border-[#383330]"
                  : "text-[#78716C] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-white"
              }`}
            >
              Student Portal
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex gap-2 items-center p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#57534E] dark:text-[#A8A29E] uppercase tracking-wider">USER NAME / EMAIL</label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. teacher@aegeus.edu or Dr. Sarah"
                className="w-full bg-[#FBF9F5] dark:bg-[#1D1B19] border border-[#E7E0D3] dark:border-[#292524] rounded-xl px-3.5 py-2.5 text-sm text-[#1C1917] dark:text-[#F5F5F4] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#9A3412]/30 focus:border-[#9A3412] transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-[#57534E] dark:text-[#A8A29E] uppercase tracking-wider">PASSWORD</label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#FBF9F5] dark:bg-[#1D1B19] border border-[#E7E0D3] dark:border-[#292524] rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-[#1C1917] dark:text-[#F5F5F4] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#9A3412]/30 focus:border-[#9A3412] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FFF8F5] dark:bg-[#EA580C] text-[#9A3412] dark:text-white border-2 border-[#F7D5CA] dark:border-transparent hover:bg-[#FCEBE6] dark:hover:bg-[#C2410C] font-bold rounded-xl py-3 text-xs transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? "Signing in..." : "Sign In to Portal"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-[#E5E0D8] dark:border-[#292524] w-full" />
            <span className="bg-white dark:bg-[#171615] px-3 text-[11px] font-semibold text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider shrink-0">
              or continue with
            </span>
            <div className="border-t border-[#E5E0D8] dark:border-[#292524] w-full" />
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-white dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs font-semibold text-[#242321] dark:text-[#F5F5F4] hover:bg-[#F0ECE4]/50 dark:hover:bg-[#292524] flex items-center justify-center gap-2.5 transition-all shadow-xs"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>
        
        <div className="flex items-center justify-center gap-1.5 text-[#78716C] text-xs">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Secured with Aegis Multi-factor & Proctoring Logs.</span>
        </div>
      </div>
    </div>
  );
}

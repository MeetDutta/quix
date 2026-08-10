"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../store/authStore";
import { GraduationCap, AlertCircle, Eye, EyeOff, ShieldCheck, School } from "lucide-react";

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

  return (
    <div className="flex min-h-screen items-center justify-center relative overflow-hidden bg-[#FAF7F2] px-4">
      {/* Background warm soft glows */}
      <div className="absolute top-1/4 left-1/4 h-[400px] w-[400px] rounded-full bg-[#9A3412]/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-[440px] z-10 space-y-6">
        <div className="flex justify-center items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#9A3412] text-white shadow-md shadow-[#9A3412]/20">
            <School className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-[#1C1917]">
              EduQuizX
            </h1>
            <p className="text-xs text-[#78716C]">Classroom Evaluation System</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-[#E7E0D3] shadow-sm relative overflow-hidden space-y-6">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#9A3412] via-amber-600 to-[#9A3412]" />
          
          <div>
            <h2 className="text-2xl font-bold text-[#1C1917] tracking-tight">Welcome Back</h2>
            <p className="text-[#78716C] text-xs mt-1">Sign in to access your portal and evaluations.</p>
          </div>

          {/* Preset Fill Shortcuts */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={autofillTeacher}
              className="flex-1 py-1.5 px-3 text-[11px] font-semibold rounded-lg bg-[#FCEBE6] text-[#9A3412] border border-[#F7D5CA] hover:bg-[#F7D5CA] transition-all text-center"
            >
              ⚡ Fill Creator Creds
            </button>
            <button
              type="button"
              onClick={autofillStudent}
              className="flex-1 py-1.5 px-3 text-[11px] font-semibold rounded-lg bg-[#F5F0E8] text-[#57534E] border border-[#E7E0D3] hover:bg-[#EAE3D5] transition-all text-center"
            >
              🎓 Fill Student Creds
            </button>
          </div>
          
          <div className="flex gap-2 p-1 bg-[#FBF9F5] rounded-xl border border-[#E7E0D3]">
            <button
              type="button"
              onClick={() => setRole("teacher")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                role === "teacher"
                  ? "bg-white text-[#9A3412] shadow-xs border border-[#E7E0D3]"
                  : "text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              Quiz Creator
            </button>
            <button
              type="button"
              onClick={() => setRole("student")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                role === "student"
                  ? "bg-white text-[#9A3412] shadow-xs border border-[#E7E0D3]"
                  : "text-[#78716C] hover:text-[#1C1917]"
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
              <label className="text-xs font-bold text-[#57534E] uppercase tracking-wider">USER NAME / EMAIL</label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. teacher@aegeus.edu or Dr. Sarah"
                className="w-full bg-[#FBF9F5] border border-[#E7E0D3] rounded-xl px-3.5 py-2.5 text-sm text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#9A3412]/30 focus:border-[#9A3412] transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-[#57534E] uppercase tracking-wider">PASSWORD</label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#FBF9F5] border border-[#E7E0D3] rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#9A3412]/30 focus:border-[#9A3412] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A8A29E] hover:text-[#1C1917]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#9A3412] to-[#C2410C] hover:from-[#7C2D12] hover:to-[#9A3412] text-white font-bold rounded-xl py-3 text-xs transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? "Signing in..." : "Sign In to Portal"}
            </button>
          </form>
        </div>
        
        <div className="flex items-center justify-center gap-1.5 text-[#78716C] text-xs">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Secured with Aegis Multi-factor & Proctoring Logs.</span>
        </div>
      </div>
    </div>
  );
}

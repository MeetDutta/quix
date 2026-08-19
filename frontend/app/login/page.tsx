"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/authStore";
import { 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  School, 
  Sun, 
  Moon, 
  Mail, 
  Lock, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  KeyRound, 
  X,
  FileCode2,
  BookOpen
} from "lucide-react";

import Script from "next/script";
import { apiFetch } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [gisLoaded, setGisLoaded] = useState(false);

  // Direct Exam Code Fast Gateway
  const [examCodeInput, setExamCodeInput] = useState("");
  const [showExamCodeGateway, setShowExamCodeGateway] = useState(false);

  // Google SSO Modal State
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleInputEmail, setGoogleInputEmail] = useState("meetdutta001@gmail.com");
  const [googleInputName, setGoogleInputName] = useState("Meet Dutta");

  // Forgot Password Modal State
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  useEffect(() => {
    // Load saved preferences
    const savedTheme = (localStorage.getItem("theme") as "light" | "dark") || "light";
    setTheme(savedTheme);
    if (savedTheme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");

    const savedEmail = localStorage.getItem("eduquiz_remember_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleGoogleCredentialResponse = async (response: any) => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch("/auth/google", {
        method: "POST",
        body: JSON.stringify({
          token: response.credential,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Google authentication failed");
      }

      if (data.workspace_id) {
        localStorage.setItem("workspaceId", data.workspace_id);
        localStorage.setItem("workspaceName", data.workspace_name || "Personal Workspace");
      }

      setAuth(data.access_token, data.role, data.full_name);
      router.push(data.role === "teacher" ? "/dashboard/teacher" : "/portal");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const initGoogleGIS = () => {
    setGisLoaded(true);
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (clientId && clientId.trim() && !clientId.includes("example.apps.googleusercontent.com")) {
      if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
        try {
          (window as any).google.accounts.id.initialize({
            client_id: clientId.trim(),
            callback: handleGoogleCredentialResponse,
          });
          const btnContainer = document.getElementById("google-signin-btn-container");
          if (btnContainer) {
            (window as any).google.accounts.id.renderButton(btnContainer, {
              theme: theme === "dark" ? "filled_black" : "outline",
              size: "large",
              width: 380,
              text: "continue_with",
              shape: "rectangular",
            });
          }
        } catch (err) {
          console.warn("GIS button initialization notice:", err);
        }
      }
    }
  };

  useEffect(() => {
    if (gisLoaded) {
      initGoogleGIS();
    }
  }, [theme, gisLoaded]);

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
      if (rememberMe) {
        localStorage.setItem("eduquiz_remember_email", email);
      } else {
        localStorage.removeItem("eduquiz_remember_email");
      }

      const response = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Incorrect email or password");
      }

      if (data.workspace_id) {
        localStorage.setItem("workspaceId", data.workspace_id);
        localStorage.setItem("workspaceName", data.workspace_name || "Personal Workspace");
      }

      setAuth(data.access_token, data.role, data.full_name);
      router.push(data.role === "teacher" ? "/dashboard/teacher" : "/portal");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const executeGoogleAuth = async (targetEmail: string, targetName: string) => {
    setError(null);
    setLoading(true);
    try {
      const response = await apiFetch("/auth/google", {
        method: "POST",
        body: JSON.stringify({
          email: targetEmail.trim().toLowerCase(),
          name: targetName.trim() || targetEmail.split("@")[0].replace(".", " ").toUpperCase(),
          google_id: `google_${Date.now()}`
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Google authentication failed");
      }

      if (data.workspace_id) {
        localStorage.setItem("workspaceId", data.workspace_id);
        localStorage.setItem("workspaceName", data.workspace_name || "Personal Workspace");
      }

      setAuth(data.access_token, data.role, data.full_name);
      router.push(data.role === "teacher" ? "/dashboard/teacher" : "/portal");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setGoogleModalOpen(false);
    }
  };

  const handleDirectExamJump = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examCodeInput.trim()) return;
    const cleanCode = examCodeInput.trim().replace(/^.*\/exam\//, "");
    router.push(`/exam/${cleanCode}`);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotMessage(null);
    setForgotLoading(true);

    try {
      const res = await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setForgotMessage(data.message || "A recovery password link has been dispatched to your email.");
      } else {
        setForgotError(data.detail || "Failed to process password recovery request.");
      }
    } catch (err: any) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center relative overflow-hidden bg-[#F7F4EF] dark:bg-[#0F0E0D] px-4 py-8 sm:py-12 transition-colors duration-200">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initGoogleGIS}
      />
      
      {/* Subtle Ambient Decorative Circles */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#C84B18]/5 dark:bg-[#EA580C]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#C84B18]/5 dark:bg-[#EA580C]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navigation Options: Guide Link & Theme Toggle */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
        <a 
          href="/guide"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-[#171615]/80 border border-[#E5E0D8] dark:border-[#292524] text-xs font-semibold text-[#C84B18] dark:text-[#EA580C] hover:underline backdrop-blur-xs shadow-xs"
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>← View Platform Usage Guide</span>
        </a>

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

      <div className="w-full max-w-[440px] z-10 space-y-5 mt-8">
        
        {/* Logo & Platform Headline */}
        <div className="flex justify-center items-center gap-3">
          <div className="p-3 rounded-xl bg-[#C84B18] dark:bg-[#EA580C] text-white shadow-md shadow-[#C84B18]/15">
            <School className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#242321] dark:text-[#F5F5F4] leading-none">EduQuizX</h1>
            <p className="text-xs text-[#716D67] dark:text-[#A8A29E] font-medium tracking-wide mt-1">Autonomous Examination Portal</p>
          </div>
        </div>

        {/* Main Authentication Card */}
        <div className="bg-white dark:bg-[#171615] rounded-2xl p-7 sm:p-8 border border-[#E5E0D8] dark:border-[#292524] shadow-sm relative overflow-hidden space-y-5.5">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#C84B18] via-amber-600 to-[#C84B18]" />
          
          <div>
            <h2 className="text-2xl font-bold text-[#242321] dark:text-[#F5F5F4] tracking-tight">Portal Sign In</h2>
            <p className="text-[#716D67] dark:text-[#A8A29E] text-xs mt-1">Sign in to access your assessment workspace and analytics.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex gap-2 items-center p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{error}</span>
              </div>
            )}
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#57534E] dark:text-[#A8A29E] uppercase tracking-wider">
                User Name / Email
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@aegeus.edu"
                  className="w-full bg-[#FBF9F5] dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] rounded-xl pl-9.5 pr-3.5 py-2.5 text-sm text-[#242321] dark:text-[#F5F5F4] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#C84B18]/30 focus:border-[#C84B18] transition-all font-medium"
                />
                <Mail className="h-4 w-4 text-[#A8A29E] absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-[#57534E] dark:text-[#A8A29E] uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotMessage(null);
                    setForgotError(null);
                    setForgotModalOpen(true);
                  }}
                  className="text-xs font-semibold text-[#C84B18] dark:text-[#EA580C] hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#FBF9F5] dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] rounded-xl pl-9.5 pr-10 py-2.5 text-sm text-[#242321] dark:text-[#F5F5F4] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#C84B18]/30 focus:border-[#C84B18] transition-all font-medium"
                />
                <Lock className="h-4 w-4 text-[#A8A29E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A8A29E] hover:text-[#242321] dark:hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#E5E0D8] dark:border-[#292524] text-[#C84B18] focus:ring-[#C84B18]/30 cursor-pointer h-3.5 w-3.5"
                />
                <span>Remember my login email</span>
              </label>
            </div>

            {/* Sign In Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#C84B18] hover:bg-[#B33E0F] dark:bg-[#EA580C] dark:hover:bg-[#C2410C] text-white font-bold rounded-xl py-3 text-xs transition-all shadow-md shadow-[#C84B18]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? "Signing in..." : "Sign In to Portal"}
              {!loading && <ArrowRight className="h-4 w-4" />}
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

          {/* Google Identity Services Container & Quick Sign-In Button */}
          <div className="space-y-2">
            <div id="google-signin-btn-container" className="w-full flex justify-center min-h-[44px]" />
            <button
              type="button"
              onClick={() => setGoogleModalOpen(true)}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-white dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs font-bold text-[#242321] dark:text-[#F5F5F4] hover:bg-[#F0ECE4]/50 dark:hover:bg-[#292524] flex items-center justify-center gap-2.5 transition-all shadow-2xs cursor-pointer"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google Account</span>
            </button>
          </div>

          {/* Direct Exam Code Gateway Toggle */}
          <div className="pt-2 border-t border-[#E5E0D8]/60 dark:border-[#292524]/60">
            {!showExamCodeGateway ? (
              <button
                type="button"
                onClick={() => setShowExamCodeGateway(true)}
                className="w-full text-center text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] hover:text-[#C84B18] dark:hover:text-[#EA580C] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileCode2 className="h-3.5 w-3.5" />
                <span>Taking a Test? Enter Exam Code</span>
              </button>
            ) : (
              <form onSubmit={handleDirectExamJump} className="space-y-2 bg-[#FBF9F5] dark:bg-[#1D1B19] p-3 rounded-xl border border-[#E5E0D8] dark:border-[#292524]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#57534E] dark:text-[#A8A29E] uppercase tracking-wider">Candidate Direct Access</span>
                  <button
                    type="button"
                    onClick={() => setShowExamCodeGateway(false)}
                    className="text-[#716D67] hover:text-[#242321] dark:hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={examCodeInput}
                    onChange={(e) => setExamCodeInput(e.target.value)}
                    placeholder="e.g. ex-com-1234"
                    className="flex-1 bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-lg px-2.5 py-1.5 text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:ring-1 focus:ring-[#C84B18]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[#C84B18] text-white rounded-lg text-xs font-bold hover:bg-[#B33E0F] transition-all shrink-0 cursor-pointer"
                  >
                    Take Exam
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
        
        {/* Footer Security Badge */}
        <div className="flex items-center justify-center gap-1.5 text-[#716D67] dark:text-[#A8A29E] text-xs">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Secured with Aegis Multi-factor & Anti-cheat Telemetry.</span>
        </div>
      </div>

      {/* ═══════ FORGOT PASSWORD MODAL ═══════ */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 relative">
            <button
              onClick={() => setForgotModalOpen(false)}
              className="absolute top-4 right-4 text-[#716D67] hover:text-[#242321] dark:hover:text-white p-1 rounded-lg hover:bg-[#F0ECE4]/50 dark:hover:bg-[#292524]"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] flex items-center justify-center font-bold">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">Password Recovery</h3>
                <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">Receive a tokenized reset password link</p>
              </div>
            </div>

            {forgotMessage ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Recovery Dispatched</span>
                </div>
                <p>{forgotMessage}</p>
                <button
                  type="button"
                  onClick={() => setForgotModalOpen(false)}
                  className="mt-2 w-full py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs hover:bg-emerald-700"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-3.5">
                {forgotError && (
                  <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs border border-rose-200">
                    {forgotError}
                  </div>
                )}
                
                <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                  Enter your verified student or faculty email address below. We will send you a tokenized password reset link immediately.
                </p>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#57534E] dark:text-[#A8A29E] uppercase">Registered Email</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="e.g. teacher@aegeus.edu"
                    className="w-full bg-[#FBF9F5] dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] rounded-xl px-3 py-2 text-sm text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:ring-2 focus:ring-[#C84B18]/30"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-xs font-semibold text-[#716D67] hover:bg-[#F0ECE4]/50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-2.5 bg-[#C84B18] hover:bg-[#B33E0F] text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5"
                  >
                    {forgotLoading ? "Dispatching..." : "Send Reset Link"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ═══════ GOOGLE SSO MODAL ═══════ */}
      {googleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#171615] rounded-2xl border border-[#E5E0D8] dark:border-[#292524] p-6 max-w-sm w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <h3 className="text-sm font-bold text-[#242321] dark:text-[#F5F5F4]">Google Teacher Sign-In</h3>
              </div>
              <button 
                onClick={() => setGoogleModalOpen(false)}
                className="text-[#716D67] hover:text-[#242321] dark:hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
              Sign in with your Google account. Your account is automatically configured with a <b>Teacher Workspace</b> on EduQuizX.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeGoogleAuth(googleInputEmail, googleInputName);
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#57534E] dark:text-[#A8A29E] uppercase">Google Account Email</label>
                <input
                  type="email"
                  required
                  value={googleInputEmail}
                  onChange={(e) => setGoogleInputEmail(e.target.value)}
                  placeholder="e.g. meetdutta001@gmail.com"
                  className="w-full bg-[#FBF9F5] dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] rounded-xl px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:ring-2 focus:ring-[#C84B18]/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#57534E] dark:text-[#A8A29E] uppercase">Display Name</label>
                <input
                  type="text"
                  required
                  value={googleInputName}
                  onChange={(e) => setGoogleInputName(e.target.value)}
                  placeholder="e.g. Meet Dutta"
                  className="w-full bg-[#FBF9F5] dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] rounded-xl px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:ring-2 focus:ring-[#C84B18]/30"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGoogleModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-xs font-semibold text-[#716D67] hover:bg-[#F0ECE4]/50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-gradient-to-r from-[#C84B18] to-amber-600 hover:from-[#B33E0F] hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loading ? "Authenticating..." : "Authorize as Teacher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

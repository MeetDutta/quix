"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
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

function LoginContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isRegisterRoute = pathname === "/register" || searchParams.get("mode") === "signup";
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [gisLoaded, setGisLoaded] = useState(false);

  // Auth Mode: "signin" | "signup"
  const [authMode, setAuthMode] = useState<"signin" | "signup">(isRegisterRoute ? "signup" : "signin");

  // Registration Form State
  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [regRole, setRegRole] = useState<"teacher" | "student">("teacher");

  // Direct Exam Code Fast Gateway
  const [examCodeInput, setExamCodeInput] = useState("");
  const [showExamCodeGateway, setShowExamCodeGateway] = useState(false);

  // Target destination query parameter
  const [targetDestination, setTargetDestination] = useState<string | null>(null);

  // Forgot Password Modal State
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const resolveDestination = (userRole: string) => {
    if (targetDestination) {
      if (targetDestination === "teacher_dashboard") return "/dashboard/teacher";
      if (targetDestination === "student_dashboard") return "/dashboard/student";
      if (targetDestination.startsWith("/")) return targetDestination;
    }
    if (userRole === "student") return "/dashboard/student";
    return "/dashboard/teacher";
  };

  useEffect(() => {
    // Check URL query parameters for initial mode, role, and target
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "signup" || window.location.pathname === "/register") {
        setAuthMode("signup");
      }
      const roleParam = params.get("role");
      if (roleParam === "student") {
        setRegRole("student");
      } else if (roleParam === "teacher") {
        setRegRole("teacher");
      }
      const targetParam = params.get("target");
      if (targetParam) {
        setTargetDestination(targetParam);
      }
    }

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
          role: regRole,
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
      router.push(resolveDestination(data.role));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const initGoogleGIS = () => {
    setGisLoaded(true);
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "716730043675-rq3tq97avgrrbtjoup3hjdhteg4k7pql.apps.googleusercontent.com";
    if (clientId && clientId.trim()) {
      if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
        try {
          (window as any).google.accounts.id.initialize({
            client_id: clientId.trim(),
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });
          const btnContainer = document.getElementById("google-signin-btn-container");
          if (btnContainer) {
            btnContainer.innerHTML = "";
            const computedWidth = typeof window !== "undefined" ? Math.min(380, Math.max(240, window.innerWidth - 64)) : 300;
            (window as any).google.accounts.id.renderButton(btnContainer, {
              theme: theme === "dark" ? "filled_black" : "outline",
              size: "large",
              width: computedWidth,
              text: authMode === "signup" ? "signup_with" : "continue_with",
              shape: "rectangular",
              logo_alignment: "left",
            });
          }
          // Optional One-Tap prompt
          try {
            (window as any).google.accounts.id.prompt();
          } catch {}
        } catch (err) {
          console.warn("GIS button initialization notice:", err);
        }
      }
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
      initGoogleGIS();
    }
  }, [theme, gisLoaded, authMode]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    if (next === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
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
      router.push(resolveDestination(data.role));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!regFullName.trim()) {
      setError("Please enter your full name");
      return;
    }
    if (!regEmail.trim()) {
      setError("Please enter a valid email address");
      return;
    }
    if (regPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: regFullName.trim(),
          email: regEmail.trim().toLowerCase(),
          password: regPassword,
          role: regRole,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Account creation failed");
      }

      if (data.workspace_id) {
        localStorage.setItem("workspaceId", data.workspace_id);
        localStorage.setItem("workspaceName", data.workspace_name || "Personal Workspace");
      }

      setAuth(data.access_token, data.role, data.full_name);
      router.push(resolveDestination(data.role));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
        body: JSON.stringify({ email: forgotEmail.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to process password reset request");
      }
      setForgotMessage(data.message || "Reset link dispatched! Please check your email inbox.");
    } catch (err: any) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, text: "", color: "" };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 10) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 1, text: "Weak", color: "bg-rose-500" };
    if (score === 2) return { score: 2, text: "Fair", color: "bg-amber-500" };
    if (score === 3) return { score: 3, text: "Good", color: "bg-blue-500" };
    return { score: 4, text: "Strong", color: "bg-emerald-500" };
  };

  const pwdStrength = getPasswordStrength(regPassword);

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
          <span className="hidden sm:inline">← View Platform Usage Guide</span>
          <span className="sm:hidden">Guide</span>
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

      <div className="w-full max-w-[460px] z-10 space-y-5 mt-8">
        
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
        <div className="bg-white dark:bg-[#171615] rounded-2xl p-5 sm:p-8 border border-[#E5E0D8] dark:border-[#292524] shadow-sm relative overflow-hidden space-y-5">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#C84B18] via-amber-600 to-[#C84B18]" />
          
          <div>
            <h2 className="text-2xl font-bold text-[#242321] dark:text-[#F5F5F4] tracking-tight">
              {authMode === "signin" ? "Portal Sign In" : "Create New Account"}
            </h2>
            <p className="text-[#716D67] dark:text-[#A8A29E] text-xs mt-1">
              {authMode === "signin" 
                ? "Sign in to access your assessment workspace and analytics." 
                : "Get started with your personalized quiz creation and proctoring workspace."}
            </p>
          </div>

          {error && (
            <div className="flex gap-2 items-center p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              SIGN IN FORM
              ═══════════════════════════════════════════════════════════════ */}
          {authMode === "signin" ? (
            <form onSubmit={handleSignInSubmit} className="space-y-4">
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
          ) : (
            /* ═══════════════════════════════════════════════════════════════
               CREATE ACCOUNT (SIGN UP) FORM
               ═══════════════════════════════════════════════════════════════ */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {/* Role Selection Tabs */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#57534E] dark:text-[#A8A29E] uppercase tracking-wider">
                  I am registering as an
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegRole("teacher")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      regRole === "teacher"
                        ? "bg-[#C84B18]/10 dark:bg-[#EA580C]/15 border-[#C84B18] dark:border-[#EA580C] text-[#C84B18] dark:text-[#EA580C]"
                        : "bg-[#FBF9F5] dark:bg-[#1D1B19] border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E]"
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <span>🎓 Educator / Teacher</span>
                    </div>
                    <div className="text-[10px] opacity-75 mt-0.5">Author quizzes & gradebooks</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegRole("student")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      regRole === "student"
                        ? "bg-[#C84B18]/10 dark:bg-[#EA580C]/15 border-[#C84B18] dark:border-[#EA580C] text-[#C84B18] dark:text-[#EA580C]"
                        : "bg-[#FBF9F5] dark:bg-[#1D1B19] border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E]"
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <span>🎒 Student / Candidate</span>
                    </div>
                    <div className="text-[10px] opacity-75 mt-0.5">Attempt tests & track results</div>
                  </button>
                </div>
              </div>

              {/* Full Name Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#57534E] dark:text-[#A8A29E] uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="e.g. Dr. Sarah Jenkins"
                  className="w-full bg-[#FBF9F5] dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] rounded-xl px-3.5 py-2.5 text-sm text-[#242321] dark:text-[#F5F5F4] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#C84B18]/30 focus:border-[#C84B18] transition-all font-medium"
                />
              </div>

              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#57534E] dark:text-[#A8A29E] uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="sarah@university.edu"
                    className="w-full bg-[#FBF9F5] dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] rounded-xl pl-9.5 pr-3.5 py-2.5 text-sm text-[#242321] dark:text-[#F5F5F4] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#C84B18]/30 focus:border-[#C84B18] transition-all font-medium"
                  />
                  <Mail className="h-4 w-4 text-[#A8A29E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Password Field with Strength Indicator */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-[#57534E] dark:text-[#A8A29E] uppercase tracking-wider">
                    Create Password
                  </label>
                  {regPassword && (
                    <span className="text-[10px] font-bold text-[#716D67] dark:text-[#A8A29E]">
                      Strength: <span className="font-semibold">{pwdStrength.text}</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={regShowPassword ? "text" : "password"}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full bg-[#FBF9F5] dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] rounded-xl pl-9.5 pr-10 py-2.5 text-sm text-[#242321] dark:text-[#F5F5F4] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#C84B18]/30 focus:border-[#C84B18] transition-all font-medium"
                  />
                  <Lock className="h-4 w-4 text-[#A8A29E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setRegShowPassword(!regShowPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A8A29E] hover:text-[#242321] dark:hover:text-white cursor-pointer"
                  >
                    {regShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Strength Meter Bar */}
                {regPassword && (
                  <div className="grid grid-cols-4 gap-1 pt-1">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-1 rounded-full transition-all ${
                          step <= pwdStrength.score ? pwdStrength.color : "bg-[#E5E0D8] dark:bg-[#292524]"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#57534E] dark:text-[#A8A29E] uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={regShowPassword ? "text" : "password"}
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full bg-[#FBF9F5] dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] rounded-xl pl-9.5 pr-3.5 py-2.5 text-sm text-[#242321] dark:text-[#F5F5F4] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#C84B18]/30 focus:border-[#C84B18] transition-all font-medium"
                  />
                  <KeyRound className="h-4 w-4 text-[#A8A29E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Sign Up Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#C84B18] hover:bg-[#B33E0F] dark:bg-[#EA580C] dark:hover:bg-[#C2410C] text-white font-bold rounded-xl py-3 text-xs transition-all shadow-md shadow-[#C84B18]/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? "Creating Account..." : "Create Account & Get Started"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-[#E5E0D8] dark:border-[#292524] w-full" />
            <span className="bg-white dark:bg-[#171615] px-3 text-[11px] font-semibold text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider shrink-0">
              or {authMode === "signup" ? "sign up with" : "continue with"}
            </span>
            <div className="border-t border-[#E5E0D8] dark:border-[#292524] w-full" />
          </div>

          {/* Google Identity Services Container */}
          <div className="w-full flex justify-center min-h-[44px]">
            <div id="google-signin-btn-container" className="w-full flex justify-center min-h-[44px]" />
          </div>

          {/* Bottom Switcher: Sign In vs Create Account */}
          <div className="text-center text-xs text-[#716D67] dark:text-[#A8A29E] pt-1">
            {authMode === "signin" ? (
              <p>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setError(null);
                  }}
                  className="font-bold text-[#C84B18] dark:text-[#EA580C] hover:underline cursor-pointer"
                >
                  Create one now →
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setError(null);
                  }}
                  className="font-bold text-[#C84B18] dark:text-[#EA580C] hover:underline cursor-pointer"
                >
                  Sign in here →
                </button>
              </p>
            )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-4 sm:p-6 max-w-md w-full shadow-2xl space-y-4 relative max-h-[92vh] overflow-y-auto">
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

      {/* ═══════ FORGOT PASSWORD MODAL ═══════ */}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F4EF] dark:bg-[#0F0E0D] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-[#C84B18] border-t-transparent animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

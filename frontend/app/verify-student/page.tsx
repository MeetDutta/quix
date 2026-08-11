"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, ShieldCheck, Mail, ArrowRight, School, Sparkles } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

function VerifyStudentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const token = searchParams.get("token");
  const provider = searchParams.get("provider");

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setErrorMessage("No verification token provided in link.");
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await apiFetch(`/auth/verify-student?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (res.ok) {
          setSuccess(true);
          setVerifiedEmail(data.email);
          setVerifiedName(data.full_name);
        } else {
          setErrorMessage(data.detail || "Invalid or expired verification link.");
        }
      } catch {
        setErrorMessage("Network error verifying student account.");
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleGoogleAuthorize = async () => {
    // Simulated Google OAuth authorization popup / client token
    setLoading(true);
    try {
      const emailToAuth = verifiedEmail || prompt("Enter your Google Account email to authorize:", "student@aegeus.edu");
      if (!emailToAuth) {
        setLoading(false);
        return;
      }

      const res = await apiFetch("/auth/google-authorize", {
        method: "POST",
        body: JSON.stringify({
          email: emailToAuth,
          name: verifiedName || "Verified Student",
          google_id: `google_${Date.now()}`
        })
      });

      const data = await res.json();
      if (res.ok) {
        setAuth(data.access_token, data.role, data.full_name);
        router.push("/dashboard/student");
      } else {
        setErrorMessage(data.detail || "Failed to authorize with Google.");
      }
    } catch {
      setErrorMessage("Google authorization network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F4EF] dark:bg-[#0F0E0D] px-4 py-12 text-[#242321] dark:text-[#F5F5F4]">
      <div className="w-full max-w-md bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-8 shadow-xl space-y-6 text-center">
        
        {/* Brand */}
        <div className="flex items-center justify-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#C84B18] dark:bg-[#EA580C] text-white">
            <School className="h-6 w-6" />
          </div>
          <span className="font-extrabold text-xl tracking-tight">EduQuizX</span>
        </div>

        {loading ? (
          <div className="py-12 space-y-4">
            <div className="w-10 h-10 border-3 border-[#C84B18] dark:border-[#EA580C] border-t-transparent rounded-full animate-spin mx-auto" />
            <h2 className="text-sm font-semibold text-[#716D67] dark:text-[#A8A29E]">Authorizing Student Profile...</h2>
          </div>
        ) : success ? (
          <div className="space-y-5 animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[#242321] dark:text-[#F5F5F4]">Account Authorized!</h2>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                Welcome <b>{verifiedName}</b> ({verifiedEmail}). Your student profile is verified.
              </p>
            </div>

            {/* Notice Card */}
            <div className="bg-[#F0ECE4]/60 dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 text-left text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-[#242321] dark:text-[#F5F5F4]">
                <Mail className="h-4 w-4 text-[#C84B18]" />
                <span>Password Generated & Dispatched</span>
              </div>
              <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E] leading-relaxed">
                A secure portal access password has been generated and sent to your email inbox (<b>{verifiedEmail}</b>).
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => router.push("/")}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-xs font-semibold"
              >
                <span>Sign in with Generated Password</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                onClick={handleGoogleAuthorize}
                className="w-full py-2.5 px-4 bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-lg text-xs font-semibold text-[#242321] dark:text-[#F5F5F4] hover:bg-[#F0ECE4]/50 dark:hover:bg-[#292524] flex items-center justify-center gap-2.5 transition-all shadow-xs"
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
          </div>
        ) : (
          <div className="space-y-5 animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-800">
              <AlertCircle className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#242321] dark:text-[#F5F5F4]">Verification Link Expired</h2>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                {errorMessage || "This authorization link is invalid or has already been used."}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={handleGoogleAuthorize}
                className="w-full py-2.5 px-4 bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-lg text-xs font-semibold text-[#242321] dark:text-[#F5F5F4] hover:bg-[#F0ECE4]/50 dark:hover:bg-[#292524] flex items-center justify-center gap-2.5 transition-all shadow-xs"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Authorize Directly with Google</span>
              </button>

              <button
                onClick={() => router.push("/")}
                className="w-full py-2 text-xs font-semibold text-[#716D67] hover:text-[#242321]"
              >
                Return to Login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyStudentPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#F7F4EF] dark:bg-[#0F0E0D] text-xs text-[#716D67]">
        Loading verification...
      </div>
    }>
      <VerifyStudentContent />
    </Suspense>
  );
}

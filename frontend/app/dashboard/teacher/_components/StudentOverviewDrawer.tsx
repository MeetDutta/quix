"use client";

import { useState, useEffect } from "react";
import { 
  X, User, Mail, Hash, Building2, Layers, CheckCircle2, AlertCircle, 
  Copy, Key, RefreshCw, Trophy, FileText, Calendar, Clock, ExternalLink, Sparkles 
} from "lucide-react";
import { apiFetch, getFrontendBaseUrl } from "../../../../lib/api";
import { useAuthStore } from "../../../../store/authStore";
import { useToast } from "../../../../components/Toast";

interface StudentOverviewDrawerProps {
  studentId: string;
  onClose: () => void;
  onRefreshDirectory: () => void;
}

export default function StudentOverviewDrawer({
  studentId,
  onClose,
  onRefreshDirectory,
}: StudentOverviewDrawerProps) {
  const { token } = useAuthStore();
  const { showToast } = useToast();

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/students/${studentId}/overview`, { token });
      if (res.ok) {
        setData(await res.json());
      } else {
        showToast("Failed to load student activity record", "error");
      }
    } catch {
      showToast("Network error loading student details", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId && token) {
      fetchOverview();
    }
  }, [studentId, token]);

  const handleInstantAuthorize = async () => {
    setIsAuthorizing(true);
    try {
      const res = await apiFetch(`/students/${studentId}/instant-authorize`, {
        method: "POST",
        token,
      });
      if (res.ok) {
        const resData = await res.json();
        showToast(`Student authorized! Password: ${resData.generated_password}`, "success");
        fetchOverview();
        onRefreshDirectory();
      } else {
        showToast("Failed to authorize student", "error");
      }
    } catch {
      showToast("Network error during authorization", "error");
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleResendAuthEmail = async () => {
    if (!data?.student?.email) return;
    setIsResending(true);
    try {
      const res = await apiFetch(`/students/${studentId}/resend-auth`, {
        method: "POST",
        token,
      });
      if (res.ok) {
        showToast(`Authorization invite emailed to ${data.student.email}`, "success");
      } else {
        showToast("Failed to dispatch authorization email", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setIsResending(false);
    }
  };

  const handleCopyLink = (url?: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    showToast("Authorization link copied to clipboard!", "success");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-[#171615] border-l border-[#E5E0D8] dark:border-[#292524] w-full max-w-xl h-full shadow-2xl flex flex-col animate-slideLeft">
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#E5E0D8] dark:border-[#292524] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] flex items-center justify-center font-bold text-sm">
              {data?.student?.full_name ? data.student.full_name[0].toUpperCase() : "S"}
            </div>
            <div>
              <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">
                {data?.student?.full_name || "Student Overview"}
              </h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] font-mono">
                {data?.student?.roll_number} • {data?.student?.email}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#716D67] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-16 text-center space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin text-[#C84B18] mx-auto" />
              <p className="text-xs text-[#716D67]">Loading student academic records...</p>
            </div>
          ) : data ? (
            <>
              {/* Account Status Banner */}
              <div className="bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">
                    Authentication Status
                  </span>
                  {data.student.is_verified ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Authorized & Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Pending Authorization
                    </span>
                  )}
                </div>

                {!data.student.is_verified && (
                  <div className="pt-2 border-t border-[#E5E0D8] dark:border-[#292524] flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isAuthorizing}
                      onClick={handleInstantAuthorize}
                      className="btn-primary py-1.5 px-3 text-xs font-bold flex items-center gap-1.5 shadow-xs"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Instant Authorize (Bypass Email)</span>
                    </button>
                    <button
                      type="button"
                      disabled={isResending}
                      onClick={handleResendAuthEmail}
                      className="px-3 py-1.5 rounded-lg border border-[#E5E0D8] dark:border-[#292524] bg-white dark:bg-[#1D1B19] text-xs font-semibold text-[#716D67] hover:text-[#242321] dark:hover:text-white flex items-center gap-1.5 transition-all"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Resend Email</span>
                    </button>
                    {data.student.verification_url && (
                      <button
                        type="button"
                        onClick={() => handleCopyLink(data.student.verification_url)}
                        className="px-3 py-1.5 rounded-lg border border-[#E5E0D8] dark:border-[#292524] bg-white dark:bg-[#1D1B19] text-xs font-semibold text-[#716D67] hover:text-[#242321] dark:hover:text-white flex items-center gap-1.5 transition-all"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Link</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* KPI Performance Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-3 text-center">
                  <div className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">Assessments</div>
                  <div className="text-xl font-bold text-[#242321] dark:text-[#F5F5F4] mt-0.5">
                    {data.stats.total_submissions}
                  </div>
                </div>

                <div className="bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-3 text-center">
                  <div className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">Average Score</div>
                  <div className="text-xl font-bold text-[#C84B18] mt-0.5">
                    {data.stats.average_percentage}%
                  </div>
                </div>

                <div className="bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-3 text-center">
                  <div className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">Tests Passed</div>
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {data.stats.passed_count}
                  </div>
                </div>
              </div>

              {/* Assessment History */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4] uppercase tracking-wider">
                  Examination History ({data.submissions.length})
                </h4>

                {data.submissions.length === 0 ? (
                  <div className="p-8 text-center border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs text-[#716D67]">
                    No assessments submitted yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.submissions.map((sub: any) => (
                      <div
                        key={sub.id}
                        className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-xs hover:border-[#C84B18]/40 transition-all"
                      >
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4]">
                            {sub.exam_name}
                          </div>
                          <div className="text-[11px] text-[#716D67] font-mono">
                            {sub.exam_code} • {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : ""}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-bold text-[#242321] dark:text-[#F5F5F4]">
                            {sub.score} / {sub.total_marks}
                          </div>
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              sub.passed
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                            }`}
                          >
                            {sub.percentage}% • {sub.passed ? "Passed" : "Failed"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

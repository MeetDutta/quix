"use client";

import { useState, useEffect } from "react";
import { 
  X, Radio, Users, Clock, ShieldAlert, CheckCircle2, 
  AlertTriangle, RefreshCw, Plus, Play, Pause, Search, UserCheck
} from "lucide-react";
import { API_V1, apiFetch } from "../../../../lib/api";
import { useAuthStore } from "../../../../store/authStore";
import { useToast } from "../../../../components/Toast";

interface LiveProctoringModalProps {
  examId?: string;
  exam?: any;
  alerts?: any[];
  onClose: () => void;
  onEndExamEarly?: (examId: string, examName: string) => Promise<void> | void;
}

export default function LiveProctoringModal({
  examId,
  exam,
  onClose,
}: LiveProctoringModalProps) {
  const { token } = useAuthStore();
  const { showToast } = useToast();

  const targetExamId = examId || exam?.id || exam?.exam_id;
  const [telemetry, setTelemetry] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isExtending, setIsExtending] = useState(false);

  const fetchLiveTelemetry = async () => {
    if (!targetExamId) return;
    try {
      const res = await apiFetch(`/exams/${targetExamId}/live-monitor`, { token });
      if (res.ok) {
        setTelemetry(await res.json());
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !targetExamId) return;
    fetchLiveTelemetry();

    if (!autoRefresh) return;
    const interval = setInterval(fetchLiveTelemetry, 4000); // 4s live polling heartbeat
    return () => clearInterval(interval);
  }, [token, targetExamId, autoRefresh]);

  const handleExtendTime = async (minutes: number = 10) => {
    if (!targetExamId) return;
    setIsExtending(true);
    try {
      const res = await apiFetch(`/exams/${targetExamId}/extend-time`, {
        method: "POST",
        token,
        body: JSON.stringify({ extra_minutes: minutes }),
      });
      if (res.ok) {
        showToast(`Granted +${minutes} minutes to all active candidates!`, "success");
        fetchLiveTelemetry();
      } else {
        showToast("Failed to extend exam time", "error");
      }
    } catch {
      showToast("Network error extending time", "error");
    } finally {
      setIsExtending(false);
    }
  };

  const filteredCandidates = (telemetry?.candidates || []).filter((c: any) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.roll_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 max-h-[92dvh] flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E0D8] dark:border-[#292524] pb-3 sm:pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative p-2.5 bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-900 shrink-0">
              <Radio className="h-5 w-5 animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="font-bold text-sm sm:text-base text-[#242321] dark:text-[#F5F5F4] truncate">
                  Live Monitor: {telemetry?.exam?.name || "Assessment"}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider">
                  LIVE
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#716D67] dark:text-[#A8A29E] truncate">
                Exam Code: <span className="font-mono font-bold text-[#C84B18]">{telemetry?.exam?.exam_code}</span> • Real-time focus tracking
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Auto-Refresh Toggle */}
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                autoRefresh
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-800 dark:text-stone-300"
              }`}
            >
              {autoRefresh ? <Play className="h-3 w-3 fill-current" /> : <Pause className="h-3 w-3" />}
              <span>{autoRefresh ? "Live Sync (4s)" : "Paused"}</span>
            </button>

            {/* Grant +10 Mins Button */}
            <button
              type="button"
              disabled={isExtending}
              onClick={() => handleExtendTime(10)}
              className="px-2.5 sm:px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              title="Add 10 extra minutes for all candidates"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+10 Mins</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#716D67] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] transition-all ml-auto sm:ml-1 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Real-time KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
          <div className="bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-3 text-center">
            <div className="text-xl font-black text-[#242321] dark:text-[#F5F5F4]">
              {telemetry?.summary?.total_assigned || 0}
            </div>
            <div className="text-[10px] font-bold text-[#716D67] uppercase tracking-wider">
              Enrolled Total
            </div>
          </div>

          <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl p-3 text-center">
            <div className="text-xl font-black text-blue-600 dark:text-blue-400">
              {telemetry?.summary?.logged_in || 0}
            </div>
            <div className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
              Active In Room
            </div>
          </div>

          <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-3 text-center">
            <div className="text-xl font-black text-amber-600 dark:text-amber-400">
              {telemetry?.summary?.in_progress || 0}
            </div>
            <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
              Answering Now
            </div>
          </div>

          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl p-3 text-center">
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {telemetry?.summary?.submitted || 0}
            </div>
            <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
              Finished & Submitted
            </div>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#716D67]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search active candidate by name, email or roll number..."
              className="w-full pl-9 pr-3 py-2 bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none"
            />
          </div>
        </div>

        {/* Live Candidates Table */}
        <div className="flex-1 overflow-y-auto border border-[#E5E0D8] dark:border-[#292524] rounded-xl">
          {loading ? (
            <div className="py-20 text-center space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin text-[#C84B18] mx-auto" />
              <p className="text-xs text-[#716D67]">Connecting to proctoring websocket stream...</p>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="py-20 text-center text-xs text-[#716D67]">
              No active candidates match your filter.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F7F4EF] dark:bg-[#141312] border-b border-[#E5E0D8] dark:border-[#292524] sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-4 font-bold text-[#716D67]">Candidate</th>
                  <th className="py-2.5 px-4 font-bold text-[#716D67]">Username / Roll</th>
                  <th className="py-2.5 px-4 font-bold text-[#716D67]">Status</th>
                  <th className="py-2.5 px-4 font-bold text-[#716D67]">Progress</th>
                  <th className="py-2.5 px-4 font-bold text-[#716D67] text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D8] dark:divide-[#292524]">
                {filteredCandidates.map((c: any) => {
                  const progressPct = c.total_questions > 0 ? (c.answered_count / c.total_questions) * 100 : 0;
                  return (
                    <tr key={c.credential_id} className="hover:bg-[#F7F4EF]/60 dark:hover:bg-[#1D1B19]/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-1.5">
                          <span>{c.name}</span>
                          {c.status === "in_progress" && (
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#716D67]">{c.email}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono text-[#242321] dark:text-[#F5F5F4] text-[11px] font-bold">{c.username}</div>
                        <div className="text-[11px] text-[#716D67]">Roll: {c.roll_number}</div>
                      </td>

                      <td className="py-3 px-4">
                        {c.status === "submitted" ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center gap-1 w-fit">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Submitted</span>
                          </span>
                        ) : c.status === "in_progress" ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-[10px] flex items-center gap-1 w-fit">
                            <Radio className="h-3 w-3 animate-pulse" />
                            <span>Testing Now</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-medium text-[10px]">
                            Not Started
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="w-36 space-y-1">
                          <div className="flex justify-between text-[10px] text-[#716D67]">
                            <span>{c.answered_count} / {c.total_questions} Questions</span>
                            <span>{Math.round(progressPct)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#E5E0D8] dark:bg-[#292524] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#C84B18] transition-all"
                              style={{ width: `${progressPct}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-[#242321] dark:text-[#F5F5F4]">
                        {c.score !== null ? `${c.score} pts` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between shrink-0 pt-3 border-t border-[#E5E0D8] dark:border-[#292524]">
          <div className="text-[11px] text-[#716D67]">
            Showing <b>{filteredCandidates.length}</b> candidates • Telemetry updates live
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-xs font-semibold text-[#716D67] hover:text-[#242321]"
          >
            Close Room
          </button>
        </div>
      </div>
    </div>
  );
}

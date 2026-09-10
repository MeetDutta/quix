"use client";

import { useState } from "react";
import { X, Award, CheckCircle2, History, AlertOctagon, Check } from "lucide-react";
import { apiFetch } from "../../../../lib/api";
import { useAuthStore } from "../../../../store/authStore";
import { useToast } from "../../../../components/Toast";

interface CandidateAttemptsModalProps {
  examId: string;
  candidate: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CandidateAttemptsModal({
  examId,
  candidate,
  onClose,
  onSuccess,
}: CandidateAttemptsModalProps) {
  const { token } = useAuthStore();
  const { showToast } = useToast();
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const attempts = candidate.attempts_history || [];

  const handleSelectResult = async (attemptNumber: number, submissionId: string) => {
    setSubmittingId(submissionId);
    try {
      const res = await apiFetch(`/exams/${examId}/candidates/${candidate.candidate_id}/select-result-attempt`, {
        method: "POST",
        token,
        body: JSON.stringify({ attempt_number: attemptNumber }),
      });

      if (res.ok) {
        showToast(`Attempt #${attemptNumber} designated as the official result!`, "success");
        onSuccess();
        onClose();
      } else {
        const err = await res.json().catch(() => ({ detail: "Failed to set result attempt" }));
        showToast(err.detail || "Failed to set result attempt", "error");
      }
    } catch {
      showToast("Network error designating result attempt", "error");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E0D8] dark:border-[#292524]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-xl">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#242321] dark:text-[#F5F5F4]">
                Attempt History & Result Selection
              </h3>
              <p className="text-xs text-[#716D67] truncate max-w-xs sm:max-w-sm">
                Student: {candidate.name} ({candidate.email})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#716D67] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Info */}
        <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
          All attempts are immutably preserved. Only one attempt is marked as the official gradebook result.
        </p>

        {/* Attempts list */}
        <div className="space-y-3 flex-1 overflow-y-auto max-h-72">
          {attempts.map((att: any) => {
            const isCounted = att.is_counted_for_result;
            const isSubmitting = submittingId === att.submission_id;

            return (
              <div
                key={att.submission_id}
                className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                  isCounted
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs"
                    : "border-[#E5E0D8] dark:border-[#292524] bg-[#F7F4EF]/60 dark:bg-[#141312]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#242321] dark:text-[#F5F5F4]">
                      Attempt #{att.attempt_number}
                    </span>
                    {isCounted && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-extrabold text-[10px] flex items-center gap-1">
                        <Award className="h-3 w-3" />
                        <span>OFFICIAL RESULT</span>
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-[#716D67]">
                    {att.submitted_at ? new Date(att.submitted_at).toLocaleTimeString() : "In Progress"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-[#E5E0D8]/40 dark:border-[#292524]/60">
                  <div>
                    <span className="text-[10px] text-[#716D67] block">Status</span>
                    <span className={`font-bold capitalize ${
                      att.status === "auto_submitted" ? "text-rose-600" : "text-emerald-600"
                    }`}>
                      {att.status.replace("_", " ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#716D67] block">Tab Strikes</span>
                    <span className="font-bold text-[#242321] dark:text-[#F5F5F4]">
                      {att.tab_switch_count} strikes
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#716D67] block">Score</span>
                    <span className="font-bold text-[#242321] dark:text-[#F5F5F4]">
                      {att.score !== null ? `${att.score} pts` : "—"}
                    </span>
                  </div>
                </div>

                {/* Select button if not currently counted */}
                {!isCounted && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSelectResult(att.attempt_number, att.submission_id)}
                      className="px-3 py-1.5 bg-[#242321] dark:bg-[#F5F5F4] text-white dark:text-[#242321] rounded-lg text-xs font-bold hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Award className="h-3.5 w-3.5" />
                      <span>{isSubmitting ? "Selecting..." : "Designate as Official Result"}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[#E5E0D8] dark:border-[#292524] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] rounded-xl font-bold text-xs hover:bg-[#F7F4EF] dark:hover:bg-[#1A1918] transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

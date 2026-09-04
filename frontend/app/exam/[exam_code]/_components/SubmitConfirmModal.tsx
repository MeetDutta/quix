"use client";

import { AlertCircle, CheckCircle2, Flag, FileQuestion, ArrowRight, X } from "lucide-react";

interface SubmitConfirmModalProps {
  questions: any[];
  answers: Record<string, any>;
  flagged: Record<string, boolean>;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

export default function SubmitConfirmModal({
  questions,
  answers,
  flagged,
  onConfirm,
  onCancel,
  loading,
}: SubmitConfirmModalProps) {
  const answeredCount = questions.filter((q) => {
    const a = answers[q.id];
    return a !== undefined && a !== null && String(a).trim() !== "";
  }).length;

  const flaggedCount = questions.filter((q) => flagged[q.id]).length;
  const unansweredCount = questions.length - answeredCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#C84B18]/10 text-[#C84B18]">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm text-[#242321] dark:text-[#F5F5F4]">
              Confirm Exam Submission
            </h3>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="p-1 rounded-lg text-[#716D67] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
          Are you sure you want to finish and submit your responses? Once submitted, your answers will be locked and graded.
        </p>

        {/* Breakdown Card */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
              {answeredCount}
            </div>
            <div className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-400 mt-0.5">
              Answered
            </div>
          </div>

          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40">
            <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
              {flaggedCount}
            </div>
            <div className="text-[10px] font-semibold text-purple-800 dark:text-purple-400 mt-0.5">
              In Review
            </div>
          </div>

          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
            <div className="text-lg font-bold text-rose-700 dark:text-rose-300">
              {unansweredCount}
            </div>
            <div className="text-[10px] font-semibold text-rose-800 dark:text-rose-400 mt-0.5">
              Unanswered
            </div>
          </div>
        </div>

        {unansweredCount > 0 && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              You still have <b>{unansweredCount} unanswered questions</b>. You may return to the test to answer them before submitting.
            </span>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-xs font-semibold text-[#716D67] hover:text-[#242321] dark:hover:text-white transition-all text-center cursor-pointer"
          >
            Return to Test
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="btn-primary w-full sm:w-auto px-5 py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Evaluating & Submitting...</span>
              </>
            ) : (
              <>
                <span>Submit Final Exam</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

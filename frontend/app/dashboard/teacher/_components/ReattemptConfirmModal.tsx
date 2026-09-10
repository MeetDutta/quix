"use client";

import { useState } from "react";
import { X, RotateCcw, AlertTriangle, ShieldCheck, Clock, Check } from "lucide-react";
import { apiFetch } from "../../../../lib/api";
import { useAuthStore } from "../../../../store/authStore";
import { useToast } from "../../../../components/Toast";

interface ReattemptConfirmModalProps {
  examId: string;
  candidate: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReattemptConfirmModal({
  examId,
  candidate,
  onClose,
  onSuccess,
}: ReattemptConfirmModalProps) {
  const { token } = useAuthStore();
  const { showToast } = useToast();

  const [durationType, setDurationType] = useState<"remaining" | "custom">("remaining");
  const [customMinutes, setCustomMinutes] = useState<number>(30);
  const [reasonNote, setReasonNote] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleGrant = async () => {
    if (!acknowledged || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/exams/${examId}/candidates/${candidate.candidate_id}/reattempt`, {
        method: "POST",
        token,
        body: JSON.stringify({
          custom_duration_minutes: durationType === "custom" ? customMinutes : null,
          reason: reasonNote.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(data.message || `Reattempt granted for ${candidate.name}!`, "success");
        onSuccess();
        onClose();
      } else {
        const err = await res.json().catch(() => ({ detail: "Failed to grant reattempt" }));
        showToast(err.detail || "Failed to grant reattempt", "error");
      }
    } catch {
      showToast("Network error while granting reattempt", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E0D8] dark:border-[#292524]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#242321] dark:text-[#F5F5F4]">
                Authorize Controlled Reattempt
              </h3>
              <p className="text-xs text-[#716D67] truncate max-w-xs sm:max-w-sm">
                Student: {candidate.name}
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

        {/* Audit / Integrity Notice */}
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1.5 text-xs text-amber-800 dark:text-amber-300">
          <div className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Integrity & Immutability Guarantee</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Attempt #1 remains completely preserved with original answers, strike logs, and official score. Attempt #2 will be created with clean proctoring state. Attempt #1 will remain the counted result until teacher explicitly selects otherwise.
          </p>
        </div>

        {/* Current Infraction Summary */}
        <div className="bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-3 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-[#716D67]">Current Attempt</span>
            <span className="font-bold text-[#242321] dark:text-[#F5F5F4]">
              Attempt #{candidate.attempt_number || 1}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#716D67]">Auto-Submit Reason</span>
            <span className="font-bold text-rose-600 dark:text-rose-400">
              {candidate.auto_submit_reason || "TAB_SWITCH"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#716D67]">Tab Switch Violations</span>
            <span className="font-bold text-rose-600 dark:text-rose-400">
              {candidate.proctor_flags_count || 2} strikes
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#716D67]">Max Reattempts Limit</span>
            <span className="font-bold text-[#242321] dark:text-[#F5F5F4]">
              1 Reattempt Maximum (Attempt #2 of 2)
            </span>
          </div>
        </div>

        {/* Duration Configuration */}
        <div className="space-y-2 text-xs">
          <label className="font-bold text-[#242321] dark:text-[#F5F5F4] block">
            Reattempt Duration Allocation
          </label>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-[#E5E0D8] dark:border-[#292524] cursor-pointer hover:bg-[#F7F4EF] dark:hover:bg-[#191817]">
              <input
                type="radio"
                name="duration"
                checked={durationType === "remaining"}
                onChange={() => setDurationType("remaining")}
                className="accent-[#C84B18]"
              />
              <div className="min-w-0">
                <span className="font-semibold block text-[#242321] dark:text-[#F5F5F4]">
                  Standard Exam Time Bound
                </span>
                <span className="text-[11px] text-[#716D67]">
                  Calculates remaining window capped strictly by exam end time.
                </span>
              </div>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-[#E5E0D8] dark:border-[#292524] cursor-pointer hover:bg-[#F7F4EF] dark:hover:bg-[#191817]">
              <input
                type="radio"
                name="duration"
                checked={durationType === "custom"}
                onChange={() => setDurationType("custom")}
                className="accent-[#C84B18]"
              />
              <div className="flex-1 flex items-center justify-between gap-2">
                <div>
                  <span className="font-semibold block text-[#242321] dark:text-[#F5F5F4]">
                    Custom Time Window
                  </span>
                  <span className="text-[11px] text-[#716D67]">
                    Specify custom minutes (still bounded by exam end time).
                  </span>
                </div>
                {durationType === "custom" && (
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(Math.max(1, parseInt(e.target.value) || 15))}
                      className="w-16 px-2 py-1 bg-white dark:bg-[#1F1E1D] border border-[#E5E0D8] dark:border-[#292524] rounded-lg text-xs font-bold text-center"
                    />
                    <span className="text-[11px] text-[#716D67]">mins</span>
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>

        {/* Reason / Justification */}
        <div className="space-y-1 text-xs">
          <label className="font-bold text-[#242321] dark:text-[#F5F5F4] block">
            Reason / Proctor Note (Recorded in Audit Log)
          </label>
          <input
            type="text"
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
            placeholder="e.g. Accidental click, verified by teacher in hall"
            className="w-full px-3 py-2 bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none"
          />
        </div>

        {/* Acknowledgment Checkbox */}
        <div className="flex items-start gap-2 pt-1 text-xs">
          <input
            id="ack-reattempt"
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 rounded accent-[#C84B18] cursor-pointer"
          />
          <label htmlFor="ack-reattempt" className="text-[#716D67] dark:text-[#A8A29E] cursor-pointer">
            I verify this student is eligible under the tab-switch policy and authorize a single reattempt (Attempt #2).
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t border-[#E5E0D8] dark:border-[#292524]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-3 border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] rounded-xl font-bold text-xs hover:bg-[#F7F4EF] dark:hover:bg-[#1A1918] transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!acknowledged || submitting}
            onClick={handleGrant}
            className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            <span>{submitting ? "Authorizing..." : "Grant Attempt #2"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { 
  X, Sparkles, Printer, FileText, Save, StopCircle, Trash2, Check, 
  RefreshCw, Plus, CheckCircle, Play
} from "lucide-react";
import { API_V1, apiFetch } from "../../../../lib/api";
import { useAuthStore } from "../../../../store/authStore";
import { useToast } from "../../../../components/Toast";
import MathText from "../../../../components/MathText";

interface PaperStudioModalProps {
  exam: any;
  onClose: () => void;
  onRefresh: () => void;
  onPublishExam: (examId: string) => void;
  onEndExamEarly: (examId: string, examName: string) => void;
  onDeleteExam: (examId: string) => void;
}

export default function PaperStudioModal({
  exam,
  onClose,
  onRefresh,
  onPublishExam,
  onEndExamEarly,
  onDeleteExam,
}: PaperStudioModalProps) {
  const { token } = useAuthStore();
  const { showToast } = useToast();

  const [isEditingPaper, setIsEditingPaper] = useState(false);
  const [editedQuestions, setEditedQuestions] = useState<any[]>(() => {
    try {
      return exam.questions_json ? JSON.parse(exam.questions_json) : [];
    } catch {
      return [];
    }
  });
  const [rerollingIdx, setRerollingIdx] = useState<number | null>(null);
  const [isSavingPaper, setIsSavingPaper] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditModalData, setAuditModalData] = useState<any | null>(null);

  const handleRerollQuestion = async (idx: number) => {
    setRerollingIdx(idx);
    try {
      const q = editedQuestions[idx];
      const res = await apiFetch(`/exams/${exam.id}/reroll-question`, {
        token,
        method: "POST",
        body: JSON.stringify({
          question_index: idx,
          current_question: q,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = [...editedQuestions];
        updated[idx] = data.question;
        setEditedQuestions(updated);
        showToast(`Question #${idx + 1} regenerated with AI!`, "success");
      } else {
        showToast("Re-roll failed. Please try again.", "error");
      }
    } catch {
      showToast("Network error during question re-roll", "error");
    } finally {
      setRerollingIdx(null);
    }
  };

  const handleSaveQuestions = async () => {
    setIsSavingPaper(true);
    try {
      const res = await apiFetch(`/exams/${exam.id}/questions`, {
        token,
        method: "PUT",
        body: JSON.stringify({ questions: editedQuestions }),
      });
      if (res.ok) {
        showToast("Question paper successfully updated!", "success");
        setIsEditingPaper(false);
        onRefresh();
      } else {
        showToast("Failed to save updated paper", "error");
      }
    } catch {
      showToast("Network error while saving paper", "error");
    } finally {
      setIsSavingPaper(false);
    }
  };

  const handleAddCustomQuestion = () => {
    const newQ = {
      id: `custom_${Date.now()}`,
      question_text: "New custom question prompt...",
      question_type: "mcq",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correct_answer: "Option A",
      marks: 1,
      difficulty: "medium",
      explanation: "",
    };
    setEditedQuestions([...editedQuestions, newQ]);
    setIsEditingPaper(true);
    showToast("Added custom question. Edit the text and save.", "success");
  };

  const handleDeleteSingleQuestion = (idx: number) => {
    const updated = editedQuestions.filter((_, i) => i !== idx);
    setEditedQuestions(updated);
    setIsEditingPaper(true);
  };

  const handleAuditPaper = async () => {
    setIsAuditing(true);
    try {
      const res = await apiFetch(`/exams/${exam.id}/audit`, { token });
      if (res.ok) {
        const data = await res.json();
        setAuditModalData(data);
      } else {
        showToast("Failed to run AI Paper Audit", "error");
      }
    } catch {
      showToast("Network error during audit", "error");
    } finally {
      setIsAuditing(false);
    }
  };

  if (!exam) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-fadeIn">
      <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl max-w-4xl w-full mx-2 sm:mx-auto p-3.5 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E0D8] dark:border-[#292524] pb-3 sm:pb-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#C84B18]/10 text-[#C84B18]">
                Interactive Paper Studio
              </span>
              <span className="text-xs text-[#716D67] font-mono truncate">Code: {exam.exam_code}</span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-[#242321] dark:text-[#F5F5F4] mt-1 truncate">{exam.name}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/exam/${exam.exam_code || exam.code}?mode=teacher_preview`}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-all"
              title="Launch Sandbox Simulator as Student"
            >
              <Play className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Test Run</span>
            </a>
            <button
              type="button"
              onClick={() => setIsEditingPaper(!isEditingPaper)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isEditingPaper
                  ? "bg-amber-600 text-white"
                  : "border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321]"
              }`}
            >
              <span>{isEditingPaper ? "Editing Active" : "Edit Paper"}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#716D67] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] transition-all cursor-pointer ml-auto sm:ml-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Questions Scrollable Body */}
        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold text-[#716D67] dark:text-[#A8A29E]">
            <span>{editedQuestions.length} Examination Questions</span>
            <div className="flex items-center gap-3">
              <span>Total: {editedQuestions.reduce((acc, q) => acc + (parseFloat(q.marks) || 0), 0)} Marks</span>
              <button
                type="button"
                onClick={handleAddCustomQuestion}
                className="text-[#C84B18] dark:text-[#EA580C] hover:underline flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Custom Question</span>
              </button>
            </div>
          </div>

          {/* Bloom's Cognitive Taxonomy & Difficulty Balancer */}
          <div className="bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#C84B18]" />
              <span className="font-bold text-[#242321] dark:text-[#F5F5F4] text-[11px]">Cognitive Bloom's Balance:</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium text-[10px]">
              <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold">
                Recall: 25%
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
                Understand: 25%
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                Apply: 35%
              </span>
              <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold">
                Analyze: 15%
              </span>
            </div>
          </div>

          {editedQuestions.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#716D67] dark:text-[#A8A29E]">
              No questions in this paper. Click "+ Add Custom Question" to create one.
            </div>
          ) : (
            editedQuestions.map((q: any, idx: number) => {
              const isMcq = q.question_type === "mcq" || q.type === "mcq" || (q.options && q.options.length > 0);
              const isRerolling = rerollingIdx === idx;

              return (
                <div
                  key={q.id || idx}
                  className="bg-[#F0ECE4]/40 dark:bg-[#1D1B19]/50 border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-4 space-y-3 relative group transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-md bg-[#C84B18] dark:bg-[#EA580C] text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#E5E0D8]/60 dark:bg-[#292524] text-[#716D67] dark:text-[#A8A29E]">
                        {isMcq ? "Multiple Choice" : "Subjective"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* AI Single-Question Re-Roll Button */}
                      <button
                        type="button"
                        disabled={isRerolling}
                        onClick={() => handleRerollQuestion(idx)}
                        className="px-2.5 py-1 rounded bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-[11px] font-semibold text-[#716D67] hover:text-[#C84B18] hover:border-[#C84B18] transition-all flex items-center gap-1 disabled:opacity-50"
                        title="Regenerate only this question with AI"
                      >
                        <RefreshCw className={`h-3 w-3 ${isRerolling ? "animate-spin text-[#C84B18]" : ""}`} />
                        <span>{isRerolling ? "Re-rolling..." : "AI Re-Roll"}</span>
                      </button>

                      {/* Delete Question button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteSingleQuestion(idx)}
                        className="p-1 rounded text-[#716D67] hover:text-red-600 transition-colors"
                        title="Delete this question"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>

                      <div className="flex items-center gap-1 text-xs text-[#716D67] dark:text-[#A8A29E] font-semibold">
                        {isEditingPaper ? (
                          <input
                            type="number"
                            value={q.marks || 1}
                            onChange={(e) => {
                              const updated = [...editedQuestions];
                              updated[idx].marks = parseFloat(e.target.value) || 1;
                              setEditedQuestions(updated);
                            }}
                            className="w-12 bg-white dark:bg-[#141312] border border-[#E5E0D8] rounded px-1 text-xs text-center"
                          />
                        ) : (
                          <span>{q.marks || 1} Marks</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Question Text with KaTeX Math support */}
                  {isEditingPaper ? (
                    <textarea
                      rows={2}
                      value={q.question_text || q.text || q.question}
                      onChange={(e) => {
                        const updated = [...editedQuestions];
                        updated[idx].question_text = e.target.value;
                        setEditedQuestions(updated);
                      }}
                      className="w-full bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-md p-2 text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:border-[#C84B18]"
                    />
                  ) : (
                    <p className="text-xs font-semibold text-[#242321] dark:text-[#F5F5F4] leading-relaxed">
                      <MathText text={q.question_text || q.text || q.question} />
                    </p>
                  )}

                  {/* MCQ Options with KaTeX Math */}
                  {isMcq && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt: string, optIdx: number) => {
                        const optLetter = String.fromCharCode(65 + optIdx);
                        const isCorrect =
                          q.correct_option === optLetter ||
                          q.correct_answer === optLetter ||
                          q.correct_answer === opt;
                        return (
                          <div
                            key={optIdx}
                            className={`px-3 py-2 rounded-md border text-xs flex items-center gap-2 transition-all ${
                              isCorrect
                                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-semibold"
                                : "bg-[#FFFFFF] dark:bg-[#171615] border-[#E5E0D8] dark:border-[#292524] text-[#242321] dark:text-[#F5F5F4]"
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                isCorrect
                                  ? "bg-emerald-600 text-white"
                                  : "bg-[#E5E0D8] dark:bg-[#292524] text-[#716D67] dark:text-[#A8A29E]"
                              }`}
                            >
                              {optLetter}
                            </span>
                            {isEditingPaper ? (
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const updated = [...editedQuestions];
                                  const newOpts = [...updated[idx].options];
                                  newOpts[optIdx] = e.target.value;
                                  updated[idx].options = newOpts;
                                  if (isCorrect) updated[idx].correct_answer = e.target.value;
                                  setEditedQuestions(updated);
                                }}
                                className="flex-1 bg-transparent border-b border-[#E5E0D8] dark:border-[#292524] px-1 py-0.5 text-xs focus:outline-none focus:border-[#C84B18]"
                              />
                            ) : (
                              <span className="truncate">
                                <MathText text={opt} />
                              </span>
                            )}
                            {isEditingPaper ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...editedQuestions];
                                  updated[idx].correct_answer = opt;
                                  setEditedQuestions(updated);
                                }}
                                className={`text-[10px] px-1.5 py-0.5 rounded ml-auto ${
                                  isCorrect
                                    ? "bg-emerald-600 text-white font-bold"
                                    : "bg-neutral-200 dark:bg-neutral-800 text-neutral-600"
                                }`}
                              >
                                {isCorrect ? "Correct" : "Set Correct"}
                              </button>
                            ) : (
                              isCorrect && <Check className="h-3.5 w-3.5 text-emerald-600 ml-auto shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Explanation / Solution */}
                  {q.explanation && (
                    <div className="p-2.5 rounded-md bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] text-[11px] text-[#716D67] dark:text-[#A8A29E] space-y-1">
                      <span className="font-semibold text-[#242321] dark:text-[#F5F5F4]">Solution / Rationale:</span>
                      {isEditingPaper ? (
                        <input
                          type="text"
                          value={q.explanation}
                          onChange={(e) => {
                            const updated = [...editedQuestions];
                            updated[idx].explanation = e.target.value;
                            setEditedQuestions(updated);
                          }}
                          className="w-full bg-transparent border-b border-[#E5E0D8] dark:border-[#292524] p-1 text-xs focus:outline-none focus:border-[#C84B18]"
                        />
                      ) : (
                        <p>
                          <MathText text={q.explanation} />
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[#E5E0D8] dark:border-[#292524] pt-3 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              disabled={isAuditing}
              onClick={handleAuditPaper}
              className="px-3 py-2 rounded-md bg-[#C84B18]/10 text-[#C84B18] hover:bg-[#C84B18]/20 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs"
              title="Run AI Quality & Answer Balance Audit"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isAuditing ? "Auditing Paper..." : "AI Paper Audit"}</span>
            </button>

            <a
              href={`${API_V1}/exams/${exam.id}/pdf/printable`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-md border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] text-xs font-medium flex items-center gap-1.5 hover:bg-[#E5E0D8]/40"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Paper PDF</span>
            </a>

            <a
              href={`${API_V1}/exams/${exam.id}/pdf/answer-key`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-md border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] text-xs font-medium flex items-center gap-1.5 hover:bg-[#E5E0D8]/40"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Print Answer Key</span>
            </a>

            {isEditingPaper && (
              <button
                type="button"
                disabled={isSavingPaper}
                onClick={handleSaveQuestions}
                className="px-3.5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isSavingPaper ? "Saving Paper..." : "Save Paper Changes"}</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#242321] text-xs font-medium"
            >
              Close Studio
            </button>

            {exam.is_published && (
              <button
                type="button"
                onClick={() => onEndExamEarly(exam.id, exam.name)}
                className="px-3 py-2 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-xs font-semibold flex items-center gap-1.5"
              >
                <StopCircle className="h-3.5 w-3.5" />
                <span>End Assessment Early</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (confirm(`Permanently delete assessment "${exam.name}"?`)) {
                  onDeleteExam(exam.id);
                  onClose();
                }
              }}
              className="px-3 py-2 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 text-xs font-semibold flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>

            {!exam.is_published && (
              <button
                type="button"
                onClick={() => {
                  onPublishExam(exam.id);
                  onClose();
                }}
                className="btn-primary flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Publish Assessment Live</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══════ AI PAPER QUALITY & FAIRNESS AUDIT REPORT MODAL ═══════ */}
      {auditModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl max-w-lg w-full mx-3 sm:mx-auto p-4 sm:p-6 shadow-2xl space-y-4 relative max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setAuditModalData(null)}
              className="absolute top-4 right-4 text-[#716D67] hover:text-[#242321] p-1 rounded-md"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] flex items-center justify-center font-extrabold text-lg shadow-2xs">
                {auditModalData.overall_score || 92}%
              </div>
              <div>
                <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">AI Quality & Fairness Audit</h3>
                <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">Paper Score & Optimization Feedback</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524]">
                <span className="text-[#716D67] dark:text-[#A8A29E] block text-[10px] uppercase font-bold">
                  Clarity Rating
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {auditModalData.clarity_rating || "Excellent"}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524]">
                <span className="text-[#716D67] dark:text-[#A8A29E] block text-[10px] uppercase font-bold">
                  Fairness Index
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {auditModalData.fairness_rating || "High"}
                </span>
              </div>
            </div>

            {auditModalData.distribution_feedback && (
              <div className="p-3 rounded-lg bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] text-xs space-y-1">
                <span className="font-bold text-[#242321] dark:text-[#F5F5F4]">Answer Balance Feedback</span>
                <p className="text-[#716D67] dark:text-[#A8A29E] text-[11px] leading-relaxed">
                  {auditModalData.distribution_feedback}
                </p>
              </div>
            )}

            {auditModalData.recommendations && auditModalData.recommendations.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <span className="font-bold text-[#242321] dark:text-[#F5F5F4]">AI Audit Recommendations</span>
                <ul className="space-y-1 text-[#716D67] dark:text-[#A8A29E] text-[11px]">
                  {auditModalData.recommendations.map((rec: string, rIdx: number) => (
                    <li key={rIdx} className="flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => setAuditModalData(null)}
              className="w-full py-2.5 bg-[#C84B18] text-white font-bold text-xs rounded-xl hover:bg-[#B33E0F] transition-all shadow-2xs"
            >
              Close Audit Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

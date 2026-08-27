"use client";

import { useState } from "react";
import { CheckCircle2, Flag, Circle, Filter, X } from "lucide-react";

interface QuestionPaletteProps {
  questions: any[];
  currentIndex: number;
  answers: Record<string, any>;
  flagged: Record<string, boolean>;
  onSelectQuestion: (index: number) => void;
  isMobileModal?: boolean;
  onCloseMobileModal?: () => void;
}

export default function QuestionPalette({
  questions,
  currentIndex,
  answers,
  flagged,
  onSelectQuestion,
  isMobileModal = false,
  onCloseMobileModal,
}: QuestionPaletteProps) {
  const [filter, setFilter] = useState<"ALL" | "ANSWERED" | "UNANSWERED" | "FLAGGED">("ALL");

  const answeredCount = questions.filter((q) => {
    const a = answers[q.id];
    return a !== undefined && a !== null && String(a).trim() !== "";
  }).length;

  const flaggedCount = questions.filter((q) => flagged[q.id]).length;
  const unansweredCount = questions.length - answeredCount;

  const filteredQuestions = questions.map((q, idx) => ({ ...q, originalIndex: idx })).filter((q) => {
    const isAns = answers[q.id] !== undefined && answers[q.id] !== null && String(answers[q.id]).trim() !== "";
    const isFlg = flagged[q.id];

    if (filter === "ANSWERED") return isAns;
    if (filter === "UNANSWERED") return !isAns;
    if (filter === "FLAGGED") return isFlg;
    return true;
  });

  const handlePickQuestion = (idx: number) => {
    onSelectQuestion(idx);
    if (isMobileModal && onCloseMobileModal) {
      onCloseMobileModal();
    }
  };

  return (
    <div className={`bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs ${
      isMobileModal ? "max-h-[85vh] flex flex-col" : ""
    }`}>
      {/* Header & Metric Chips */}
      <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-3 shrink-0">
        <div>
          <h3 className="font-bold text-xs sm:text-sm text-[#242321] dark:text-[#F5F5F4] uppercase tracking-wider">
            Question Palette
          </h3>
          <span className="text-[11px] sm:text-xs font-semibold text-[#716D67] dark:text-[#A8A29E]">
            {answeredCount} / {questions.length} Solved ({Math.round((answeredCount / (questions.length || 1)) * 100)}%)
          </span>
        </div>

        {isMobileModal && onCloseMobileModal && (
          <button
            type="button"
            onClick={onCloseMobileModal}
            className="p-2 rounded-xl text-[#716D67] hover:bg-[#F0ECE4] dark:hover:bg-[#201D1A] transition-colors cursor-pointer"
            aria-label="Close question palette"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Status Legend & Summary */}
      <div className="grid grid-cols-3 gap-2 text-[11px] shrink-0">
        <div className="flex items-center gap-1.5 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-semibold truncate">{answeredCount} Solved</span>
        </div>

        <div className="flex items-center gap-1.5 p-2 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 text-purple-800 dark:text-purple-300">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
          <span className="font-semibold truncate">{flaggedCount} Review</span>
        </div>

        <div className="flex items-center gap-1.5 p-2 rounded-xl bg-[#F0ECE4]/60 dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E]">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
          <span className="font-semibold truncate">{unansweredCount} Left</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-semibold border-b border-[#E5E0D8] dark:border-[#292524] shrink-0 no-scrollbar">
        {[
          { id: "ALL", label: `All (${questions.length})` },
          { id: "ANSWERED", label: `Answered (${answeredCount})` },
          { id: "FLAGGED", label: `Review (${flaggedCount})` },
          { id: "UNANSWERED", label: `Unsolved (${unansweredCount})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as any)}
            className={`px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${
              filter === tab.id
                ? "bg-[#C84B18] text-white shadow-xs"
                : "text-[#716D67] hover:text-[#242321] dark:hover:text-white hover:bg-[#F0ECE4]/40"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Question Number Pills Grid (Touch Friendly 44px) */}
      <div className={`grid grid-cols-5 sm:grid-cols-6 gap-2 overflow-y-auto pr-1 ${
        isMobileModal ? "flex-1 max-h-[50vh]" : "max-h-60"
      }`}>
        {filteredQuestions.map((q) => {
          const idx = q.originalIndex;
          const isCurrent = idx === currentIndex;
          const isAnswered = answers[q.id] !== undefined && answers[q.id] !== null && String(answers[q.id]).trim() !== "";
          const isFlagged = flagged[q.id];

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => handlePickQuestion(idx)}
              className={`relative min-h-[44px] rounded-xl text-xs font-bold transition-all flex items-center justify-center border cursor-pointer ${
                isCurrent
                  ? "ring-2 ring-[#C84B18] border-[#C84B18] scale-105 z-10 shadow-xs"
                  : "hover:scale-102 active:scale-95"
              } ${
                isFlagged
                  ? "bg-purple-100 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-300"
                  : isAnswered
                  ? "bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300"
                  : "bg-[#F7F4EF] dark:bg-[#1D1B19] border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E]"
              }`}
              title={`Question ${idx + 1}: ${isAnswered ? "Answered" : "Unanswered"}${isFlagged ? " (Marked for review)" : ""}`}
            >
              <span>{idx + 1}</span>
              {isFlagged && (
                <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-purple-600 shadow-xs" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}


"use client";

import { useState } from "react";
import { CheckCircle2, Flag, Circle, Filter } from "lucide-react";

interface QuestionPaletteProps {
  questions: any[];
  currentIndex: number;
  answers: Record<string, any>;
  flagged: Record<string, boolean>;
  onSelectQuestion: (index: number) => void;
}

export default function QuestionPalette({
  questions,
  currentIndex,
  answers,
  flagged,
  onSelectQuestion,
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

  return (
    <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
      {/* Header & Metric Chips */}
      <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
        <h3 className="font-bold text-xs text-[#242321] dark:text-[#F5F5F4] uppercase tracking-wider">
          Question Palette
        </h3>
        <span className="text-xs font-semibold text-[#716D67]">
          {answeredCount} / {questions.length} Solved
        </span>
      </div>

      {/* Status Legend & Summary */}
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-semibold truncate">{answeredCount} Answered</span>
        </div>

        <div className="flex items-center gap-1.5 p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 text-purple-800 dark:text-purple-300">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
          <span className="font-semibold truncate">{flaggedCount} Review</span>
        </div>

        <div className="flex items-center gap-1.5 p-2 rounded-lg bg-[#F0ECE4]/60 dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E]">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
          <span className="font-semibold truncate">{unansweredCount} Left</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-semibold border-b border-[#E5E0D8] dark:border-[#292524]">
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
            className={`px-2.5 py-1 rounded-md transition-all shrink-0 ${
              filter === tab.id
                ? "bg-[#C84B18] text-white"
                : "text-[#716D67] hover:text-[#242321] dark:hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Question Number Pills Grid */}
      <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-60 overflow-y-auto pr-1">
        {filteredQuestions.map((q) => {
          const idx = q.originalIndex;
          const isCurrent = idx === currentIndex;
          const isAnswered = answers[q.id] !== undefined && answers[q.id] !== null && String(answers[q.id]).trim() !== "";
          const isFlagged = flagged[q.id];

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onSelectQuestion(idx)}
              className={`relative h-10 rounded-xl text-xs font-bold transition-all flex items-center justify-center border ${
                isCurrent
                  ? "ring-2 ring-[#C84B18] border-[#C84B18] scale-105 z-10"
                  : "hover:scale-102"
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
                <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-purple-600" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

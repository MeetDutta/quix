"use client";

import { useState, useEffect } from "react";
import { BookOpen, Plus, RefreshCw, X } from "lucide-react";
import { apiFetch } from "../../../../lib/api";
import { useAuthStore } from "../../../../store/authStore";
import { useToast } from "../../../../components/Toast";
import MathText from "../../../../components/MathText";

export default function QuestionBankManager() {
  const { token } = useAuthStore();
  const { showToast } = useToast();

  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankDifficulty, setBankDifficulty] = useState("");
  const [showAddBankModal, setShowAddBankModal] = useState(false);

  // Form states for creating bank question
  const [newBankText, setNewBankText] = useState("");
  const [newBankType, setNewBankType] = useState("MCQ");
  const [newBankDiff, setNewBankDiff] = useState("medium");
  const [newBankOptions, setNewBankOptions] = useState(["", "", "", ""]);
  const [newBankCorrect, setNewBankCorrect] = useState("");

  const fetchBankQuestions = async () => {
    setLoadingBank(true);
    try {
      let url = "/kb/questions/bank";
      const params = new URLSearchParams();
      if (bankSearch) params.append("search", bankSearch);
      if (bankDifficulty) params.append("difficulty", bankDifficulty);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await apiFetch(url, { token });
      if (res.ok) {
        const data = await res.json();
        setBankQuestions(data || []);
      }
    } catch {
      showToast("Failed to fetch Question Bank", "error");
    } finally {
      setLoadingBank(false);
    }
  };

  useEffect(() => {
    if (token) fetchBankQuestions();
  }, [token]);

  const handleCreateBankQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        question_text: newBankText,
        question_type: newBankType,
        difficulty: newBankDiff,
        correct_answer: newBankCorrect,
      };
      if (newBankType === "MCQ") {
        payload.options_json = JSON.stringify(newBankOptions.filter((o) => o.trim() !== ""));
      }

      const res = await apiFetch("/kb/questions/bank", {
        token,
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast("Question added to Question Bank!", "success");
        setShowAddBankModal(false);
        setNewBankText("");
        setNewBankCorrect("");
        setNewBankOptions(["", "", "", ""]);
        fetchBankQuestions();
      } else {
        showToast("Failed to add question to bank", "error");
      }
    } catch {
      showToast("Network error while adding question", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#C84B18]" />
              <span>Question Bank Studio</span>
            </h2>
            <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-0.5">
              Browse, filter, and manage reusable questions across subjects and topics.
            </p>
          </div>

          <button
            onClick={() => setShowAddBankModal(true)}
            className="btn-primary flex items-center gap-2 text-xs py-2 px-4 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Question to Bank</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <input
            type="text"
            value={bankSearch}
            onChange={(e) => setBankSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchBankQuestions()}
            placeholder="Search question text..."
            className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4]"
          />

          <select
            value={bankDifficulty}
            onChange={(e) => {
              setBankDifficulty(e.target.value);
              fetchBankQuestions();
            }}
            className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4]"
          >
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          <button
            onClick={fetchBankQuestions}
            className="px-4 py-2 bg-[#E5E0D8] dark:bg-[#292524] hover:bg-[#D8D2C7] text-[#242321] dark:text-[#F5F5F4] rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingBank ? "animate-spin" : ""}`} />
            <span>Filter Question Bank</span>
          </button>
        </div>
      </div>

      {/* Question List Cards */}
      <div className="space-y-3">
        {bankQuestions.length === 0 ? (
          <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-8 text-center text-xs text-[#716D67] dark:text-[#A8A29E]">
            No questions found in bank. Add questions or save exam-generated questions.
          </div>
        ) : (
          bankQuestions.map((q, idx) => {
            let optionsList: string[] = [];
            try {
              optionsList = q.options_json ? JSON.parse(q.options_json) : [];
            } catch {}

            return (
              <div
                key={q.id || idx}
                className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 space-y-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-[10px] font-semibold uppercase tracking-wider">
                      <span className="px-2 py-0.5 rounded bg-[#C84B18]/10 text-[#C84B18]">
                        {q.subject_name || "General"}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                        {q.difficulty || "medium"}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                        {q.question_type}
                      </span>
                      {q.topic && <span className="text-[#716D67] font-normal">Topic: {q.topic}</span>}
                    </div>
                    <h3 className="text-sm font-semibold text-[#242321] dark:text-[#F5F5F4] pt-1">
                      <MathText text={`${idx + 1}. ${q.question_text}`} />
                    </h3>
                  </div>
                </div>

                {/* Options list if MCQ */}
                {optionsList.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {optionsList.map((opt, oIdx) => (
                      <div
                        key={oIdx}
                        className={`px-3 py-1.5 rounded-lg text-xs border ${
                          opt === q.correct_answer || String.fromCharCode(65 + oIdx) === q.correct_answer
                            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold"
                            : "bg-[#F7F4EF] dark:bg-[#141312] border-[#E5E0D8] dark:border-[#292524] text-[#242321] dark:text-[#F5F5F4]"
                        }`}
                      >
                        <span className="font-bold mr-2">{String.fromCharCode(65 + oIdx)}.</span>
                        <MathText text={opt} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Bank Question Modal */}
      {showAddBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
              <h3 className="text-sm font-bold text-[#242321] dark:text-[#F5F5F4]">Add Custom Question to Bank</h3>
              <button
                onClick={() => setShowAddBankModal(false)}
                className="text-[#716D67] hover:text-[#242321]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBankQuestion} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Question Text</label>
                <textarea
                  required
                  value={newBankText}
                  onChange={(e) => setNewBankText(e.target.value)}
                  placeholder="Enter question wording..."
                  className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-2 text-xs"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Type</label>
                  <select
                    value={newBankType}
                    onChange={(e) => setNewBankType(e.target.value)}
                    className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-2 text-xs"
                  >
                    <option value="MCQ">Multiple Choice</option>
                    <option value="True_False">True / False</option>
                    <option value="Subjective">Subjective / Written</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Difficulty</label>
                  <select
                    value={newBankDiff}
                    onChange={(e) => setNewBankDiff(e.target.value)}
                    className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-2 text-xs"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              {newBankType === "MCQ" && (
                <div className="space-y-2">
                  <label className="block font-semibold">Options</label>
                  {newBankOptions.map((opt, oIdx) => (
                    <input
                      key={oIdx}
                      type="text"
                      placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                      value={opt}
                      onChange={(e) => {
                        const copy = [...newBankOptions];
                        copy[oIdx] = e.target.value;
                        setNewBankOptions(copy);
                      }}
                      className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-2 text-xs"
                    />
                  ))}
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1">Correct Answer</label>
                <input
                  type="text"
                  required
                  value={newBankCorrect}
                  onChange={(e) => setNewBankCorrect(e.target.value)}
                  placeholder="e.g. Option text or A/B/C/D"
                  className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg p-2 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddBankModal(false)}
                  className="px-4 py-2 border border-[#E5E0D8] dark:border-[#292524] rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save to Question Bank
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuthStore } from "../../../store/authStore";
import { 
  Award, Calendar, FileText, CheckCircle, TrendingUp, BookOpen, Download,
  Trophy, Target, BarChart3, XCircle, ChevronDown, ChevronUp, Medal,
  RefreshCw, CheckCircle2, AlertCircle, Clock, Sparkles, User, ArrowRight,
  BookMarked, HelpCircle, ShieldCheck
} from "lucide-react";

import { apiFetch } from "../../../lib/api";

export default function StudentDashboard() {
  const { token, fullName, role } = useAuthStore();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [selectedSubDetail, setSelectedSubDetail] = useState<any | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<"questions" | "topics" | "leaderboard">("questions");
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>("");

  const isTeacher = role === "teacher" || role === "inst_admin" || role === "super_admin";

  const fetchData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      if (isTeacher) {
        const sRes = await apiFetch("/students/", { token });
        const sData = await sRes.json();
        if (sRes.ok && Array.isArray(sData)) {
          setStudentsList(sData);
        }
      }

      const url = selectedStudentFilter ? `/reports/my-submissions?student_id=${selectedStudentFilter}` : "/reports/my-submissions";
      const res = await apiFetch(url, { token });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setSubmissions(data);
        if (data.length > 0) {
          const firstId = selectedSubId || data[0].id;
          setSelectedSubId(firstId);
          loadSubDetail(firstId);
        } else {
          setSelectedSubId(null);
          setSelectedSubDetail(null);
        }
      }
    } catch {
    } finally {
      if (isManual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, selectedStudentFilter]);

  const loadSubDetail = async (subId: string) => {
    setSelectedSubId(subId);
    setLoadingDetail(true);
    try {
      const res = await apiFetch(`/reports/submission-detail/${subId}`, { token });
      const data = await res.json();
      if (res.ok) {
        setSelectedSubDetail(data);
        if (data.exam_id) {
          const lbRes = await apiFetch(`/reports/leaderboard/${data.exam_id}`, { token });
          const lbData = await lbRes.json();
          if (lbRes.ok && Array.isArray(lbData)) {
            setLeaderboard(lbData);
          }
        }
      }
    } catch {
    } finally {
      setLoadingDetail(false);
    }
  };

  // ── Overall KPIs ──
  const stats = useMemo(() => {
    if (submissions.length === 0) return { best: 0, avg: 0, count: 0, passRate: 0 };
    const percs = submissions.map(s => Number(s.percentage) || 0);
    const best = Math.max(...percs);
    const avg = percs.reduce((a, b) => a + b, 0) / percs.length;
    const passed = submissions.filter(s => (s.percentage || 0) >= 50).length;
    return {
      best: Math.round(best),
      avg: Math.round(avg),
      count: submissions.length,
      passRate: Math.round((passed / submissions.length) * 100)
    };
  }, [submissions]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* ═══════ TOP HEADER & SUMMARY BANNER ═══════ */}
      <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] flex items-center justify-center font-bold text-lg border border-[#C84B18]/20">
              <GraduationCapIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#242321] dark:text-[#F5F5F4]">
                  {fullName || (isTeacher ? "Instructor Portal" : "Student Candidate")}
                </h1>
                {isTeacher ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>Teacher / Staff View</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Verified Student</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-0.5">
                {isTeacher 
                  ? "Instructor Preview: Inspect individual student quiz evaluations & performance trends."
                  : "Personalized Quiz-by-Quiz Performance & Learning Analytics"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            {isTeacher && studentsList.length > 0 && (
              <div className="flex items-center gap-1.5 bg-[#F0ECE4]/60 dark:bg-[#1D1B19] px-3 py-1.5 rounded-lg border border-[#E5E0D8] dark:border-[#292524] text-xs">
                <span className="text-[#716D67] font-semibold">Filter:</span>
                <select
                  value={selectedStudentFilter}
                  onChange={(e) => setSelectedStudentFilter(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-[#242321] dark:text-[#F5F5F4] focus:outline-none cursor-pointer"
                >
                  <option value="">All Students Submissions</option>
                  {studentsList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.full_name} ({st.roll_number})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="px-3.5 py-1.5 rounded-lg border border-[#E5E0D8] dark:border-[#292524] hover:bg-[#F0ECE4]/60 dark:hover:bg-[#292524] text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] flex items-center gap-1.5 transition-all shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-[#C84B18]" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Overall KPI Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mt-5 pt-5 border-t border-[#E5E0D8] dark:border-[#292524]">
          <div className="bg-[#F0ECE4]/40 dark:bg-[#1D1B19]/50 rounded-lg p-3.5 border border-[#E5E0D8] dark:border-[#292524]">
            <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">Quizzes Completed</div>
            <div className="text-2xl font-bold text-[#242321] dark:text-[#F5F5F4] mt-1">{stats.count}</div>
            <div className="text-[10px] text-[#716D67] dark:text-[#A8A29E] mt-0.5">Attempted assessments</div>
          </div>

          <div className="bg-[#F0ECE4]/40 dark:bg-[#1D1B19]/50 rounded-lg p-3.5 border border-[#E5E0D8] dark:border-[#292524]">
            <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">Overall Average</div>
            <div className="text-2xl font-bold text-[#C84B18] dark:text-[#EA580C] mt-1">{stats.avg}%</div>
            <div className="text-[10px] text-[#716D67] dark:text-[#A8A29E] mt-0.5">Cohort grade average</div>
          </div>

          <div className="bg-[#F0ECE4]/40 dark:bg-[#1D1B19]/50 rounded-lg p-3.5 border border-[#E5E0D8] dark:border-[#292524]">
            <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">Best Quiz Score</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.best}%</div>
            <div className="text-[10px] text-[#716D67] dark:text-[#A8A29E] mt-0.5">Highest recorded score</div>
          </div>

          <div className="bg-[#F0ECE4]/40 dark:bg-[#1D1B19]/50 rounded-lg p-3.5 border border-[#E5E0D8] dark:border-[#292524]">
            <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">Pass Rate</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.passRate}%</div>
            <div className="text-[10px] text-[#716D67] dark:text-[#A8A29E] mt-0.5">Quizzes cleared successfully</div>
          </div>
        </div>
      </div>

      {submissions.length === 0 ? (
        <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-12 text-center space-y-3">
          <BookOpen className="h-10 w-10 text-[#716D67] mx-auto opacity-50" />
          <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">No Quiz Attempts Recorded Yet</h3>
          <p className="text-xs text-[#716D67] dark:text-[#A8A29E] max-w-sm mx-auto">
            When you complete an assessment or exam, your quiz-by-quiz performance summary, grade breakdown, and learning recommendations will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* ═══════ LEFT: QUIZ-WISE ATTEMPTS LIST ═══════ */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">
                Completed Quizzes ({submissions.length})
              </h2>
              <span className="text-[11px] text-[#716D67]">Select to inspect</span>
            </div>

            <div className="space-y-2.5">
              {submissions.map((sub) => {
                const isSelected = sub.id === selectedSubId;
                const isPassed = (sub.percentage || 0) >= 50;
                return (
                  <button
                    key={sub.id}
                    onClick={() => loadSubDetail(sub.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all text-xs space-y-2.5 ${
                      isSelected
                        ? "bg-[#C84B18]/5 border-[#C84B18] shadow-xs dark:bg-[#EA580C]/10 dark:border-[#EA580C]"
                        : "bg-white dark:bg-[#171615] border-[#E5E0D8] dark:border-[#292524] hover:border-[#C84B18]/50 hover:bg-[#F0ECE4]/30 dark:hover:bg-[#1D1B19]/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-[#242321] dark:text-[#F5F5F4] text-xs line-clamp-1">
                          {sub.exam_name || "Assessment"}
                        </div>
                        <div className="text-[11px] text-[#716D67] dark:text-[#A8A29E] mt-0.5 flex items-center gap-1.5 font-mono">
                          <Calendar className="h-3 w-3" />
                          <span>{sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : "Recent"}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                        isPassed 
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" 
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                      }`}>
                        {isPassed ? "PASSED" : "FAILED"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#E5E0D8]/60 dark:border-[#292524]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-[#716D67]">Score:</span>
                        <span className="font-bold text-[#242321] dark:text-[#F5F5F4]">
                          {sub.score} / {sub.max_score}
                        </span>
                      </div>
                      <div className="font-extrabold text-sm text-[#C84B18] dark:text-[#EA580C]">
                        {sub.percentage}%
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ═══════ RIGHT: DEDICATED QUIZ PERFORMANCE SUMMARY ═══════ */}
          <div className="lg:col-span-8">
            {loadingDetail ? (
              <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-16 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-[#C84B18] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-[#716D67] font-medium">Loading Quiz Evaluation & Breakdown...</p>
              </div>
            ) : selectedSubDetail ? (
              <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-5 md:p-6 shadow-xs space-y-6">
                
                {/* Quiz Header & Score Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E0D8] dark:border-[#292524]">
                  <div>
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#716D67] dark:text-[#A8A29E]">
                      Code: {selectedSubDetail.exam_code || "EXAM"}
                    </span>
                    <h2 className="text-lg font-bold text-[#242321] dark:text-[#F5F5F4] mt-0.5">
                      {selectedSubDetail.exam_name}
                    </h2>
                  </div>

                  <div className="flex items-center gap-3 bg-[#F0ECE4]/60 dark:bg-[#1D1B19] px-4 py-2.5 rounded-xl border border-[#E5E0D8] dark:border-[#292524] self-start sm:self-auto">
                    <div>
                      <div className="text-[10px] text-[#716D67] uppercase font-bold">Earned Score</div>
                      <div className="text-xl font-extrabold text-[#C84B18] dark:text-[#EA580C]">
                        {selectedSubDetail.score} <span className="text-xs font-normal text-[#716D67]">/ {selectedSubDetail.max_score}</span>
                      </div>
                    </div>
                    <div className="h-8 w-px bg-[#E5E0D8] dark:bg-[#292524]" />
                    <div>
                      <div className="text-[10px] text-[#716D67] uppercase font-bold">Accuracy</div>
                      <div className="text-xl font-extrabold text-[#242321] dark:text-[#F5F5F4]">
                        {selectedSubDetail.percentage}%
                      </div>
                    </div>
                    {selectedSubDetail.rank && (
                      <>
                        <div className="h-8 w-px bg-[#E5E0D8] dark:bg-[#292524]" />
                        <div>
                          <div className="text-[10px] text-[#716D67] uppercase font-bold">Class Rank</div>
                          <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                            #{selectedSubDetail.rank}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* AI Learning Critique & Roadmap */}
                {selectedSubDetail.ai_feedback && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                      <Sparkles className="h-4 w-4 text-[#C84B18] shrink-0" />
                      <span>AI Learning Diagnosis & Recommendations</span>
                    </div>
                    <p className="text-xs text-amber-900 dark:text-amber-200/90 leading-relaxed pl-6">
                      {selectedSubDetail.ai_feedback}
                    </p>
                  </div>
                )}

                {/* Navigation Tabs (Questions / Topics / Leaderboard) */}
                <div className="flex gap-2 border-b border-[#E5E0D8] dark:border-[#292524] pb-2">
                  <button
                    onClick={() => setActiveViewTab("questions")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      activeViewTab === "questions"
                        ? "bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C]"
                        : "text-[#716D67] hover:text-[#242321]"
                    }`}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>Question-by-Question Review</span>
                  </button>

                  <button
                    onClick={() => setActiveViewTab("topics")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      activeViewTab === "topics"
                        ? "bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C]"
                        : "text-[#716D67] hover:text-[#242321]"
                    }`}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>Topic Mastery Breakdown</span>
                  </button>

                  <button
                    onClick={() => setActiveViewTab("leaderboard")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      activeViewTab === "leaderboard"
                        ? "bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C]"
                        : "text-[#716D67] hover:text-[#242321]"
                    }`}
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    <span>Cohort Leaderboard</span>
                  </button>
                </div>

                {/* ══════ TAB 1: QUESTION-BY-QUESTION REVIEW ══════ */}
                {activeViewTab === "questions" && (
                  <div className="space-y-4">
                    {selectedSubDetail.questions && selectedSubDetail.questions.length > 0 ? (
                      selectedSubDetail.questions.map((q: any, idx: number) => {
                        const isCorrect = q.is_correct;
                        return (
                          <div
                            key={idx}
                            className={`p-4 rounded-xl border transition-all text-xs space-y-3 ${
                              isCorrect
                                ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50"
                                : "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-[#716D67] font-mono">Q{idx + 1}.</span>
                                <div>
                                  <div className="font-semibold text-[#242321] dark:text-[#F5F5F4] text-xs leading-relaxed">
                                    {q.question_text || q.question}
                                  </div>
                                  {q.topic && (
                                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] bg-[#E5E0D8]/60 dark:bg-[#292524] text-[#716D67] dark:text-[#A8A29E] font-medium">
                                      Topic: {q.topic}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 flex items-center gap-1 ${
                                isCorrect 
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300"
                              }`}>
                                {isCorrect ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                <span>{q.score_awarded ?? (isCorrect ? q.marks : 0)} / {q.marks || 1} Marks</span>
                              </span>
                            </div>

                            {/* Options Breakdown */}
                            <div className="space-y-1.5 pl-6">
                              {q.options && typeof q.options === "object" && Object.entries(q.options).map(([optKey, optVal]: [string, any]) => {
                                const isUserChoice = String(q.user_answer) === optKey;
                                const isActualCorrect = String(q.correct_answer) === optKey;
                                
                                return (
                                  <div
                                    key={optKey}
                                    className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                                      isActualCorrect
                                        ? "bg-emerald-100/60 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-semibold"
                                        : isUserChoice
                                        ? "bg-rose-100/60 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200"
                                        : "bg-white/60 dark:bg-[#171615]/60 border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E]"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold uppercase">{optKey}.</span>
                                      <span>{optVal}</span>
                                    </div>
                                    <div className="text-[10px] font-bold">
                                      {isActualCorrect && <span className="text-emerald-700 dark:text-emerald-300">✓ Correct Answer</span>}
                                      {isUserChoice && !isActualCorrect && <span className="text-rose-700 dark:text-rose-300">✗ Your Choice</span>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Explanation / Critique */}
                            {q.explanation && (
                              <div className="pl-6 pt-1 text-[11px] text-[#716D67] dark:text-[#A8A29E] leading-relaxed border-t border-[#E5E0D8]/40 dark:border-[#292524]/60">
                                <span className="font-semibold text-[#242321] dark:text-[#F5F5F4]">Explanation: </span>
                                {q.explanation}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-8 text-center text-[#716D67] text-xs">
                        Question breakdown is not available for this record.
                      </div>
                    )}
                  </div>
                )}

                {/* ══════ TAB 2: TOPIC MASTERY BREAKDOWN ══════ */}
                {activeViewTab === "topics" && (
                  <div className="space-y-4">
                    {selectedSubDetail.topic_analysis && Object.keys(selectedSubDetail.topic_analysis).length > 0 ? (
                      <div className="space-y-3">
                        {Object.entries(selectedSubDetail.topic_analysis).map(([topicName, tdata]: [string, any]) => {
                          const acc = tdata.accuracy ?? 0;
                          return (
                            <div key={topicName} className="p-4 rounded-xl bg-[#F0ECE4]/30 dark:bg-[#1D1B19]/50 border border-[#E5E0D8] dark:border-[#292524] space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-[#242321] dark:text-[#F5F5F4]">{topicName}</span>
                                <span className="font-bold text-[#C84B18] dark:text-[#EA580C]">{acc}% Accuracy</span>
                              </div>
                              <div className="w-full bg-[#E5E0D8] dark:bg-[#292524] h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    acc >= 75 ? "bg-emerald-500" : acc >= 50 ? "bg-amber-500" : "bg-rose-500"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, acc))}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[10px] text-[#716D67]">
                                <span>{tdata.correct || 0} of {tdata.total || 0} questions correct</span>
                                <span>{acc >= 75 ? "Mastered" : acc >= 50 ? "Developing" : "Needs Review"}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-[#716D67] text-xs">
                        Topic analysis is not available for this exam.
                      </div>
                    )}
                  </div>
                )}

                {/* ══════ TAB 3: LEADERBOARD ══════ */}
                {activeViewTab === "leaderboard" && (
                  <div className="space-y-3">
                    <div className="divide-y divide-[#E5E0D8] dark:divide-[#292524] border border-[#E5E0D8] dark:border-[#292524] rounded-xl overflow-hidden">
                      {leaderboard.length === 0 ? (
                        <div className="p-8 text-center text-xs text-[#716D67]">No leaderboard data available.</div>
                      ) : (
                        leaderboard.map((lb: any, idx: number) => {
                          const isMe = lb.student_name === fullName || lb.name === fullName;
                          return (
                            <div
                              key={idx}
                              className={`p-3 flex items-center justify-between text-xs transition-colors ${
                                isMe 
                                  ? "bg-[#C84B18]/10 dark:bg-[#EA580C]/15 font-semibold" 
                                  : "bg-white dark:bg-[#171615] hover:bg-[#F0ECE4]/30 dark:hover:bg-[#1D1B19]/30"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                                  idx === 0 ? "bg-amber-100 text-amber-800" : idx === 1 ? "bg-slate-200 text-slate-700" : idx === 2 ? "bg-amber-700/20 text-amber-900" : "text-[#716D67]"
                                }`}>
                                  {idx + 1}
                                </span>
                                <span className="text-[#242321] dark:text-[#F5F5F4]">
                                  {lb.student_name || lb.name || "Candidate"} {isMe && "(You)"}
                                </span>
                              </div>
                              <span className="font-bold text-[#C84B18] dark:text-[#EA580C]">
                                {lb.percentage || lb.score}%
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

              </div>
            ) : null}
          </div>

        </div>
      )}

    </div>
  );
}

function GraduationCapIcon(props: any) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  );
}

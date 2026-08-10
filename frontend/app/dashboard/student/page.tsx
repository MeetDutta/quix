"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuthStore } from "../../../store/authStore";
import { 
  Award, 
  Calendar, 
  FileText, 
  CheckCircle, 
  TrendingUp, 
  BookOpen, 
  Download,
  Trophy,
  Target,
  BarChart3,
  XCircle,
  ChevronDown,
  ChevronUp,
  Medal,
  QrCode,
  X,
  Printer,
  RefreshCw
} from "lucide-react";

import { apiFetch } from "../../../lib/api";

export default function StudentDashboard() {
  const { token, fullName, role } = useAuthStore();
  const isTeacherView = role === "teacher" || role === "inst_admin" || role === "super_admin";
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [allExams, setAllExams] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [qrModalExam, setQrModalExam] = useState<any | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      // Fetch published exams for active exam cards
      const resExams = await apiFetch("/exams/", { token });
      const examsData = await resExams.json();
      if (resExams.ok && Array.isArray(examsData)) {
        setAllExams(examsData.filter((e: any) => e.is_published));
      }

      // Fetch my submissions directly from dedicated backend endpoint
      const resSub = await apiFetch("/reports/my-submissions", { token });
      const subData = await resSub.json();
      if (resSub.ok && Array.isArray(subData)) {
        setSubmissions(subData);
        setLastRefreshed(new Date());

        // Auto-load details of latest submission if none selected yet
        if (subData.length > 0 && !selectedSub) {
          loadSubDetail(subData[0].id);
        }
      }
    } catch (e) {
    } finally {
      if (isManual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
      // Auto refresh data every 30 seconds
      const interval = setInterval(() => fetchData(), 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const loadSubDetail = async (subId: string) => {
    try {
      const res = await apiFetch(`/reports/submission-detail/${subId}`, { token });
      const data = await res.json();
      if (res.ok) {
        setSelectedSub(data);
        // Load leaderboard for this exam
        if (data.exam_id) {
          const lbRes = await apiFetch(`/reports/leaderboard/${data.exam_id}`, { token });
          const lbData = await lbRes.json();
          if (lbRes.ok) setLeaderboard(lbData);
        }
      }
    } catch (e) {}
  };

  // ── Computed Stats ──
  const stats = useMemo(() => {
    if (submissions.length === 0) return { best: 0, worst: 0, avg: 0, count: 0 };
    const percs = submissions.map(s => s.percentage);
    return {
      best: Math.max(...percs),
      worst: Math.min(...percs),
      avg: percs.reduce((a, b) => a + b, 0) / percs.length,
      count: submissions.length
    };
  }, [submissions]);

  // ── Weak Topics (for AI recommendations) ──
  const weakTopics = useMemo(() => {
    if (!selectedSub?.topic_analysis) return [];
    return Object.entries(selectedSub.topic_analysis)
      .map(([topic, data]: [string, any]) => ({ topic, accuracy: data.accuracy }))
      .filter(t => t.accuracy < 70)
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [selectedSub]);

  // ── SVG Score Trend Chart ──
  const TrendChart = () => {
    if (submissions.length < 2) return null;
    const sorted = [...submissions].sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
    const w = 400, h = 120, pad = 30;
    const maxY = 100;
    const points = sorted.map((s, i) => {
      const x = pad + (i / (sorted.length - 1)) * (w - pad * 2);
      const y = h - pad - (s.percentage / maxY) * (h - pad * 2);
      return { x, y, pct: s.percentage, name: s.exam_name };
    });
    const polyline = points.map(p => `${p.x},${p.y}`).join(" ");
    const areaPath = `M${points[0].x},${h - pad} ${points.map(p => `L${p.x},${p.y}`).join(" ")} L${points[points.length - 1].x},${h - pad} Z`;

    return (
      <div className="bg-white border border-[#E7E0D3] rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#9A3412]" />
          <h3 className="font-bold text-sm text-[#1C1917]">Score Trend</h3>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: 140 }}>
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(v => {
            const y = h - pad - (v / maxY) * (h - pad * 2);
            return (
              <g key={v}>
                <line x1={pad} y1={y} x2={w - pad} y2={y} stroke="#E7E0D3" strokeWidth="0.5" strokeDasharray="4,4" />
                <text x={pad - 6} y={y + 3} textAnchor="end" fontSize="8" fill="#A8A29E">{v}%</text>
              </g>
            );
          })}
          {/* Area fill */}
          <path d={areaPath} fill="url(#trendGrad)" opacity="0.3" />
          <defs>
            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9A3412" />
              <stop offset="100%" stopColor="#FAF7F2" />
            </linearGradient>
          </defs>
          {/* Line */}
          <polyline points={polyline} fill="none" stroke="#9A3412" strokeWidth="2" strokeLinejoin="round" />
          {/* Data points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#9A3412" strokeWidth="2" />
              <text x={p.x} y={h - pad + 14} textAnchor="middle" fontSize="7" fill="#78716C" className="select-none">
                {sorted[i].exam_name.slice(0, 8)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ═══════ HEADER WITH REFRESH ═══════ */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#E7E0D3] p-5 rounded-2xl shadow-xs">
        <div>
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-block mb-1.5 uppercase tracking-wider ${
            isTeacherView 
              ? "bg-purple-100 text-purple-800 border border-purple-200"
              : "bg-[#FCEBE6] text-[#9A3412] border border-[#F7D5CA]"
          }`}>
            {isTeacherView ? "📊 Classroom Population Summary" : "🎓 Personal Student Analytics"}
          </span>
          <h1 className="text-xl font-bold text-[#1C1917]">
            {isTeacherView ? "Classroom Population Overview" : `Welcome, ${fullName || "Student"}`}
          </h1>
          <p className="text-xs text-[#78716C]">
            {isTeacherView 
              ? "Summarized metrics and grade distribution for the entire student population"
              : "Personal scorecards, score trend analysis & printable response booklet access"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#78716C] hidden sm:inline">
            Updated {Math.floor((Date.now() - lastRefreshed.getTime()) / 1000)}s ago
          </span>
          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="bg-[#FBF9F5] border border-[#E7E0D3] hover:bg-[#F3EDE2] text-[#292524] text-xs font-semibold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            title="Refresh dashboard data"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#9A3412] ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ═══════ STATS CARDS ROW ═══════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Trophy, label: "Best Score", value: `${stats.best.toFixed(1)}%`, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
          { icon: Target, label: "Needs Attention", value: `${stats.worst.toFixed(1)}%`, color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
          { icon: BarChart3, label: "Average Score", value: `${stats.avg.toFixed(1)}%`, color: "text-[#9A3412]", bg: "bg-[#FCEBE6]", border: "border-[#F7D5CA]" },
          { icon: Award, label: "Tests Taken", value: `${stats.count}`, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
        ].map(({ icon: Icon, label, value, color, bg, border }) => (
          <div key={label} className={`${bg} border ${border} rounded-2xl p-4 space-y-2`}>
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">{label}</span>
            </div>
            <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* ═══════ TREND CHART + ACTIVE EXAMS ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <TrendChart />

          {/* Dynamic AI Recommendations */}
          <div className="bg-white border border-[#E7E0D3] p-5 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#9A3412]" />
              <h3 className="font-bold text-sm text-[#1C1917]">AI Learning Focus</h3>
            </div>
            {weakTopics.length > 0 ? (
              <div className="space-y-2">
                {weakTopics.slice(0, 3).map(t => (
                  <div key={t.topic} className="flex items-center gap-2 text-xs">
                    <span className="text-rose-600 font-bold">⚠</span>
                    <span className="text-[#57534E]">
                      Focus on <b className="text-[#1C1917]">{t.topic}</b> — {t.accuracy.toFixed(0)}% accuracy
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#57534E] leading-relaxed">
                {submissions.length > 0
                  ? "Great work! Your scores are strong across all topics. Keep reviewing regularly to maintain your edge."
                  : "Complete your first exam to get personalized AI coaching insights."}
              </p>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Published Exams */}
          <div className="bg-white border border-[#E7E0D3] p-6 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1C1917]">Active Published Exams</h3>
              <span className="text-xs text-[#78716C]">{allExams.length} live</span>
            </div>

            <div className="space-y-3">
              {allExams.map((ex) => {
                const hasTaken = submissions.some(s => s.exam_id === ex.id);
                return (
                  <div key={ex.id} className="p-4 bg-[#FCEBE6] border border-[#F7D5CA] rounded-xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#1C1917]">{ex.name}</span>
                        {hasTaken && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                            Completed ✓
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#78716C] mt-1">
                        Duration: {ex.duration_minutes} mins | Code: <code className="font-mono text-[#9A3412] font-bold">{ex.exam_code}</code>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQrModalExam(ex)}
                        className="bg-white border border-[#F7D5CA] text-[#9A3412] hover:bg-[#FCEBE6] text-xs font-semibold px-3 py-2 rounded-xl transition-all flex items-center gap-1 shadow-xs"
                        title="Scan QR Code to Open Exam on Mobile"
                      >
                        <QrCode className="h-4 w-4" />
                        <span className="hidden sm:inline">QR</span>
                      </button>
                      <a
                        href={`/exam/${ex.exam_code}`}
                        className="bg-gradient-to-r from-[#9A3412] to-[#C2410C] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs"
                      >
                        {hasTaken ? "Retake Portal" : "Enter Exam Portal"}
                      </a>
                    </div>
                  </div>
                );
              })}

              {allExams.length === 0 && (
                <div className="text-sm text-[#78716C] text-center py-6">No live exams scheduled right now.</div>
              )}
            </div>
          </div>

          {/* Past History */}
          <div className="bg-white border border-[#E7E0D3] p-6 rounded-2xl shadow-xs space-y-4">
            <h3 className="text-base font-bold text-[#1C1917]">Past Examination History</h3>
            
            <div className="space-y-3">
              {submissions.map((sub) => {
                const isPassed = sub.percentage >= 40;
                return (
                  <div key={sub.id} className="p-4 bg-[#FBF9F5] border border-[#E7E0D3] rounded-xl flex items-center justify-between flex-wrap gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#1C1917]">{sub.exam_name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isPassed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                          {isPassed ? "Passed ✓" : "Failed ✕"}
                        </span>
                      </div>
                      <div className="text-xs text-[#78716C] mt-1">
                        Score: <b className="text-[#9A3412]">{sub.score}</b> ({sub.percentage.toFixed(1)}%)
                        {sub.submitted_at && (
                          <span className="ml-2 text-[#A8A29E]">
                            • {new Date(sub.submitted_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mini percentage badge */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xs font-extrabold ${
                      sub.percentage >= 70 ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : sub.percentage >= 40 ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}>
                      {sub.percentage.toFixed(0)}%
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`http://localhost:8000/api/v1/reports/submission-detail/${sub.id}/printable`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-[#FCEBE6] border border-[#F7D5CA] text-[#9A3412] hover:bg-[#F7D5CA] text-xs font-semibold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
                        title="Download/Print full Response Sheet with Correct Answers"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Sheet</span>
                      </a>

                      <button
                        onClick={() => loadSubDetail(sub.id)}
                        className="bg-[#FBF9F5] border border-[#E7E0D3] text-[#292524] hover:bg-[#F3EDE2] text-xs font-semibold px-3.5 py-2 rounded-xl transition-all"
                      >
                        View Report
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {submissions.length === 0 && (
                <div className="text-sm text-[#78716C] text-center py-6">No exam submissions found.</div>
              )}
            </div>
          </div>

          {/* ═══════ DETAILED ANALYTICS VIEW ═══════ */}
          {selectedSub && (
            <div className="space-y-5">
              {/* Header + Score + Rank */}
              <div className="bg-white border border-[#E7E0D3] p-6 rounded-2xl shadow-xs space-y-5">
                <div className="flex justify-between items-start border-b border-[#F0E8DD] pb-4">
                  <div>
                    <h3 className="text-base font-bold text-[#1C1917]">{selectedSub.exam_name}</h3>
                    <span className="text-xs text-[#78716C]">Detailed Performance Analysis</span>
                  </div>
                  <div className="flex gap-4 items-center">
                    {/* Rank Badge */}
                    {selectedSub.rank && (
                      <div className="text-center">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-sm ${
                          selectedSub.rank <= 3 ? "bg-amber-50 text-amber-700 border border-amber-300" : "bg-[#FBF9F5] text-[#78716C] border border-[#E7E0D3]"
                        }`}>
                          {selectedSub.rank <= 3 ? <Medal className="h-5 w-5" /> : `#${selectedSub.rank}`}
                        </div>
                        <span className="text-[10px] text-[#78716C] font-bold">
                          {selectedSub.rank <= 3 ? `#${selectedSub.rank}` : "Rank"} / {selectedSub.total_participants}
                        </span>
                      </div>
                    )}
                    <div className="text-right">
                      <div className="text-xl font-extrabold text-[#9A3412]">{selectedSub.score} / {selectedSub.max_score}</div>
                      <span className="text-xs text-[#78716C]">{selectedSub.percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                {/* AI critique */}
                {selectedSub.ai_feedback && (
                  <div className="p-4 bg-[#FCEBE6] border border-[#F7D5CA] rounded-xl space-y-1">
                    <span className="text-xs font-bold text-[#9A3412] uppercase tracking-wider">AI Coaching Report</span>
                    <p className="text-xs text-[#57534E] leading-relaxed">{selectedSub.ai_feedback}</p>
                  </div>
                )}
              </div>

              {/* Topic Strength Bars */}
              {selectedSub.topic_analysis && Object.keys(selectedSub.topic_analysis).length > 0 && (
                <div className="bg-white border border-[#E7E0D3] p-6 rounded-2xl shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-[#F0E8DD] pb-3">
                    <BarChart3 className="h-4 w-4 text-[#9A3412]" />
                    <h3 className="font-bold text-sm text-[#1C1917]">Topic-Wise Accuracy</h3>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(selectedSub.topic_analysis).map(([topic, data]: [string, any]) => {
                      const pct = data.accuracy;
                      const barColor = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-rose-500";
                      const textColor = pct >= 70 ? "text-emerald-700" : pct >= 40 ? "text-amber-700" : "text-rose-700";
                      return (
                        <div key={topic} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#1C1917]">{topic}</span>
                            <span className={`font-bold ${textColor}`}>
                              {pct.toFixed(0)}% ({data.correct}/{data.total} correct)
                            </span>
                          </div>
                          <div className="w-full bg-[#F0E8DD] rounded-full h-2">
                            <div
                              className={`${barColor} h-2 rounded-full transition-all duration-700`}
                              style={{ width: `${Math.max(2, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Per-Question Breakdown Table */}
              {selectedSub.evaluated_answers && Object.keys(selectedSub.evaluated_answers).length > 0 && (
                <div className="bg-white border border-[#E7E0D3] rounded-2xl shadow-xs overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === "questions" ? null : "questions")}
                    className="w-full p-5 flex items-center justify-between hover:bg-[#FBF9F5] transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-[#9A3412]" />
                      <h3 className="font-bold text-sm text-[#1C1917]">Question-by-Question Breakdown</h3>
                      <span className="text-[10px] text-[#78716C] bg-[#F0E8DD] px-2 py-0.5 rounded-full font-semibold">
                        {Object.keys(selectedSub.evaluated_answers).length} questions
                      </span>
                    </div>
                    {expandedSection === "questions" ? <ChevronUp className="h-4 w-4 text-[#78716C]" /> : <ChevronDown className="h-4 w-4 text-[#78716C]" />}
                  </button>

                  {expandedSection === "questions" && (
                    <div className="border-t border-[#E7E0D3]">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-[#FBF9F5] text-[#78716C] uppercase text-[10px] tracking-wider">
                              <th className="px-4 py-3 text-left font-bold">#</th>
                              <th className="px-4 py-3 text-left font-bold">Question</th>
                              <th className="px-4 py-3 text-left font-bold">Your Answer</th>
                              <th className="px-4 py-3 text-left font-bold">Correct Answer</th>
                              <th className="px-4 py-3 text-center font-bold">Status</th>
                              <th className="px-4 py-3 text-right font-bold">Marks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(selectedSub.evaluated_answers).map(([qId, qData]: [string, any], idx) => (
                              <tr
                                key={qId}
                                className={`border-t border-[#F0E8DD] ${
                                  qData.is_correct ? "bg-emerald-50/40" : "bg-rose-50/30"
                                }`}
                              >
                                <td className="px-4 py-3 font-bold text-[#78716C]">{idx + 1}</td>
                                <td className="px-4 py-3 text-[#1C1917] max-w-[200px] truncate font-medium">
                                  {qData.question_text?.slice(0, 60)}{(qData.question_text?.length || 0) > 60 ? "..." : ""}
                                </td>
                                <td className={`px-4 py-3 max-w-[150px] truncate font-medium ${
                                  qData.is_correct ? "text-emerald-700" : "text-rose-700"
                                }`}>
                                  {String(qData.selected_answer || "—").slice(0, 50)}
                                </td>
                                <td className="px-4 py-3 text-emerald-700 font-semibold max-w-[150px] truncate">
                                  {String(qData.correct_answer || "—").slice(0, 50)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {qData.is_correct ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                                      <CheckCircle className="h-3 w-3" /> Correct
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full font-bold">
                                      <XCircle className="h-3 w-3" /> Wrong
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-[#1C1917]">
                                  {(qData.score_awarded || 0).toFixed(1)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mini Leaderboard */}
              {leaderboard.length > 0 && (
                <div className="bg-white border border-[#E7E0D3] p-6 rounded-2xl shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-[#F0E8DD] pb-3">
                    <Trophy className="h-4 w-4 text-amber-600" />
                    <h3 className="font-bold text-sm text-[#1C1917]">Exam Leaderboard</h3>
                    <span className="text-[10px] text-[#78716C] bg-[#F0E8DD] px-2 py-0.5 rounded-full font-semibold">
                      Top 5
                    </span>
                  </div>

                  <div className="space-y-2">
                    {leaderboard.slice(0, 5).map((entry, i) => {
                      const isMe = entry.student_name === fullName;
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                            isMe ? "bg-[#FCEBE6] border border-[#F7D5CA]" : "bg-[#FBF9F5] border border-[#E7E0D3]"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold ${
                            i === 0 ? "bg-amber-100 text-amber-700 border border-amber-300"
                            : i === 1 ? "bg-gray-100 text-gray-600 border border-gray-300"
                            : i === 2 ? "bg-orange-100 text-orange-700 border border-orange-300"
                            : "bg-[#FBF9F5] text-[#78716C] border border-[#E7E0D3]"
                          }`}>
                            {entry.rank}
                          </div>
                          <div className="flex-1">
                            <span className={`text-xs font-semibold ${isMe ? "text-[#9A3412]" : "text-[#1C1917]"}`}>
                              {entry.student_name} {isMe && "(You)"}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-[#9A3412]">{entry.score} pts</span>
                          <span className="text-[10px] text-[#78716C] font-semibold">{entry.percentage.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Download Actions */}
              <div className="flex flex-wrap gap-2 justify-end">
                <a
                  href={`http://localhost:8000/api/v1/reports/submission-detail/${selectedSub.submission_id || selectedSub.id}/printable`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-gradient-to-r from-[#9A3412] to-[#C2410C] text-white font-semibold text-xs px-4 py-2 rounded-xl hover:from-[#7C2D12] hover:to-[#9A3412] transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <FileText className="h-4 w-4" />
                  <span>Download Printable Response Booklet (PDF)</span>
                </a>

                <button
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedSub, null, 2));
                    const a = document.createElement("a");
                    a.href = dataStr;
                    a.download = `scorecard_${selectedSub.exam_name.replace(/\s+/g, "_")}.json`;
                    a.click();
                  }}
                  className="bg-[#FBF9F5] border border-[#E7E0D3] text-[#292524] hover:bg-[#F3EDE2] text-xs font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
                >
                  <Download className="h-4 w-4 text-[#9A3412]" />
                  <span>Download JSON Summary</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ QR CODE MODAL ═══════ */}
      {qrModalExam && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-[#E7E0D3] shadow-xl text-center space-y-5 animate-fadeIn relative">
            <button
              onClick={() => setQrModalExam(null)}
              className="absolute top-4 right-4 p-1 rounded-lg text-[#78716C] hover:bg-[#F5F0E8] transition-all"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex p-3 rounded-2xl bg-[#FCEBE6] text-[#9A3412] border border-[#F7D5CA] mb-1">
                <QrCode className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-[#1C1917]">{qrModalExam.name}</h3>
              <p className="text-xs text-[#78716C]">Scan with mobile camera to launch secure exam portal</p>
            </div>

            {/* High-Resolution QR Code */}
            <div className="bg-[#FBF9F5] border border-[#E7E0D3] rounded-2xl p-4 inline-block mx-auto shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`http://localhost:3000/exam/${qrModalExam.exam_code}`)}`}
                alt={`QR Code for ${qrModalExam.name}`}
                className="w-48 h-48 mx-auto rounded-lg"
              />
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-[#FCEBE6] border border-[#F7D5CA] rounded-xl p-2.5 flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-[#9A3412] truncate">
                  http://localhost:3000/exam/{qrModalExam.exam_code}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`http://localhost:3000/exam/${qrModalExam.exam_code}`);
                  }}
                  className="bg-white border border-[#E7E0D3] px-2 py-1 rounded-lg text-[#9A3412] font-bold hover:bg-[#F3EDE2] shrink-0"
                >
                  Copy
                </button>
              </div>

              <div className="text-[11px] text-[#78716C]">
                Exam Code: <b className="font-mono text-[#9A3412]">{qrModalExam.exam_code}</b>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

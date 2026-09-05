"use client";

import { useState, useEffect } from "react";
import { 
  BarChart3, Download, Trophy, BookOpen, FileText, ExternalLink, X 
} from "lucide-react";
import { API_V1, apiFetch } from "../../../../lib/api";
import { useAuthStore } from "../../../../store/authStore";
import { useToast } from "../../../../components/Toast";

interface GradebookAnalyticsProps {
  exams: any[];
}

export default function GradebookAnalytics({ exams }: GradebookAnalyticsProps) {
  const { token } = useAuthStore();
  const { showToast } = useToast();

  const [selectedReportExamId, setSelectedReportExamId] = useState<string | null>(null);
  const [reportAnalytics, setReportAnalytics] = useState<any | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [studentAnswerModal, setStudentAnswerModal] = useState<any | null>(null);

  const loadExamAnalytics = async (examId: string) => {
    setSelectedReportExamId(examId);
    setLoadingReport(true);
    try {
      const res = await apiFetch(`/reports/exam-summary/${examId}`, { token });
      if (res.ok) {
        const data = await res.json();
        setReportAnalytics(data);
      } else {
        showToast("Failed to calculate report analytics", "error");
      }
    } catch {
      showToast("Network error while generating reports", "error");
    } finally {
      setLoadingReport(false);
    }
  };

  const inspectStudentAnswerSheet = async (submissionId: string) => {
    try {
      const res = await apiFetch(`/reports/submission-detail/${submissionId}`, { token });
      if (res.ok) {
        const data = await res.json();
        setStudentAnswerModal(data);
      } else {
        showToast("Could not retrieve student submission sheet", "error");
      }
    } catch {
      showToast("Network error loading student sheet", "error");
    }
  };

  const handleDownloadGradebookCSV = async (examId: string, examName: string) => {
    try {
      const res = await apiFetch(`/reports/exam-summary/${examId}/export-csv`, { token });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Gradebook_${examName.replace(/\s+/g, "_")}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast("Class gradebook CSV exported successfully!", "success");
      }
    } catch {
      showToast("Failed to download gradebook CSV", "error");
    }
  };

  useEffect(() => {
    if (exams.length > 0 && !selectedReportExamId) {
      loadExamAnalytics(exams[0].id);
    }
  }, [exams]);

  const formatNum = (val: any, decimals = 1) => {
    if (val === undefined || val === null || isNaN(Number(val))) return "0";
    const num = Number(val);
    return Number.isInteger(num) ? String(num) : Number(num.toFixed(decimals)).toString();
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: Quiz Selector & 1-Click CSV Export */}
      <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#C84B18]" />
              <span>Generalized Classroom Quiz Analytics</span>
            </h2>
            <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-0.5">
              Select a quiz to view generalized cohort performance, score distributions, and individual student results.
            </p>
          </div>

          {reportAnalytics && (
            <button
              onClick={() => handleDownloadGradebookCSV(reportAnalytics.exam_id, reportAnalytics.exam_name)}
              className="px-3.5 py-1.5 rounded-lg border border-[#E5E0D8] dark:border-[#292524] hover:bg-[#F0ECE4]/60 dark:hover:bg-[#292524] text-xs font-semibold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-1.5 self-start sm:self-auto transition-all shadow-xs"
            >
              <Download className="h-3.5 w-3.5 text-[#C84B18]" />
              <span>Export Gradebook CSV</span>
            </button>
          )}
        </div>

        {/* Assessment Selector Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-t border-[#E5E0D8] dark:border-[#292524]">
          {exams.length === 0 ? (
            <div className="text-xs text-[#716D67] py-2">No assessments created yet.</div>
          ) : (
            exams.map((ex) => {
              const isSelected = ex.id === selectedReportExamId;
              return (
                <button
                  key={ex.id}
                  onClick={() => loadExamAnalytics(ex.id)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold shrink-0 transition-all border ${
                    isSelected
                      ? "bg-[#C84B18] text-white border-[#C84B18] shadow-xs"
                      : "bg-[#F0ECE4]/40 dark:bg-[#1D1B19] border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{ex.name}</span>
                    <span className="text-[10px] opacity-75 font-mono">({ex.exam_code || ex.code})</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {loadingReport ? (
        <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-16 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#C84B18] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#716D67] font-medium">Computing Classroom Analytics & Distributions...</p>
        </div>
      ) : reportAnalytics ? (
        <div className="space-y-6">
          {/* ════ Generalized Summary Metric KPI Cards ════ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
            <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 shadow-xs">
              <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">
                Attendance
              </div>
              <div className="text-2xl font-bold text-[#242321] dark:text-[#F5F5F4] mt-1">
                {reportAnalytics.attended_count}{" "}
                <span className="text-xs text-[#716D67] font-normal">/ {reportAnalytics.total_enrolled}</span>
              </div>
              <div className="text-[10px] text-[#716D67] mt-0.5">{formatNum(reportAnalytics.attendance_rate)}% Participation</div>
            </div>

            <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 shadow-xs">
              <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">
                Class Average
              </div>
              <div className="text-2xl font-bold text-[#C84B18] dark:text-[#EA580C] mt-1">
                {formatNum(reportAnalytics.average_score)}{" "}
                <span className="text-xs text-[#716D67] font-normal">/ {formatNum(reportAnalytics.total_marks)}</span>
              </div>
              <div className="text-[10px] text-[#716D67] mt-0.5">{formatNum(reportAnalytics.average_percentage)}% Average</div>
            </div>

            <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 shadow-xs">
              <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">
                Pass Rate
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {formatNum(reportAnalytics.pass_rate)}%
              </div>
              <div className="text-[10px] text-[#716D67] mt-0.5">
                {reportAnalytics.pass_count} Passed · {reportAnalytics.fail_count} Failed
              </div>
            </div>

            <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 shadow-xs">
              <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">
                Highest Score
              </div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 truncate">
                {formatNum(reportAnalytics.highest_score)}
              </div>
              <div className="text-[10px] text-[#716D67] mt-0.5">Top candidate score</div>
            </div>

            <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 shadow-xs col-span-2 lg:col-span-1">
              <div className="text-[11px] font-medium text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">
                Lowest Score
              </div>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1 truncate">
                {formatNum(reportAnalytics.lowest_score)}
              </div>
              <div className="text-[10px] text-[#716D67] mt-0.5">Passing: {formatNum(reportAnalytics.passing_marks)} Marks</div>
            </div>
          </div>

          {/* ════ Score Distribution & Topic Difficulty Analysis ════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Score Distribution Brackets */}
            <div className="lg:col-span-6 bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
              <h3 className="text-sm font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#C84B18]" />
                <span>Cohort Score Distribution</span>
              </h3>

              <div className="space-y-3 pt-1 text-xs">
                {[
                  {
                    label: "80% - 100% (Distinction)",
                    count: reportAnalytics.distribution?.["80_100"] || 0,
                    color: "bg-emerald-500",
                  },
                  {
                    label: "60% - 79% (Proficient)",
                    count: reportAnalytics.distribution?.["60_80"] || 0,
                    color: "bg-blue-500",
                  },
                  {
                    label: "40% - 59% (Passing)",
                    count: reportAnalytics.distribution?.["40_60"] || 0,
                    color: "bg-amber-500",
                  },
                  {
                    label: "0% - 39% (Needs Improvement)",
                    count: reportAnalytics.distribution?.["0_40"] || 0,
                    color: "bg-rose-500",
                  },
                ].map((bracket) => {
                  const total = reportAnalytics.attended_count || 1;
                  const pct = Math.round((bracket.count / total) * 100);
                  return (
                    <div key={bracket.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-[#242321] dark:text-[#F5F5F4]">{bracket.label}</span>
                        <span className="font-bold text-[#716D67] dark:text-[#A8A29E]">
                          {bracket.count} students ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-[#E5E0D8] dark:bg-[#292524] h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${bracket.color} rounded-full transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Topic Difficulty & Error Trends */}
            <div className="lg:col-span-6 bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
              <h3 className="text-sm font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[#C84B18]" />
                <span>Topic Difficulty & Accuracy Trends</span>
              </h3>

              <div className="space-y-3 pt-1 text-xs">
                {reportAnalytics.topic_analytics && reportAnalytics.topic_analytics.length > 0 ? (
                  reportAnalytics.topic_analytics.map((t: any) => (
                    <div
                      key={t.topic}
                      className="p-3 rounded-lg bg-[#F0ECE4]/40 dark:bg-[#1D1B19]/50 border border-[#E5E0D8] dark:border-[#292524] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#242321] dark:text-[#F5F5F4]">{t.topic}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.accuracy >= 75
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : t.accuracy >= 50
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                          }`}
                        >
                          {t.accuracy}% Class Accuracy ({t.difficulty})
                        </span>
                      </div>
                      <div className="w-full bg-[#E5E0D8] dark:bg-[#292524] h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            t.accuracy >= 75
                              ? "bg-emerald-500"
                              : t.accuracy >= 50
                              ? "bg-amber-500"
                              : "bg-rose-500"
                          }`}
                          style={{ width: `${t.accuracy}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[#716D67] py-6 text-center">
                    Topic analysis will populate as student submissions are recorded.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ════ Student Performance Roster Table ════ */}
          <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-[#C84B18]" />
                  <span>Student Results & Proctoring Audit</span>
                </h3>
                <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-0.5">
                  Individual student rankings, earned marks, and anti-cheat telemetry.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[#E5E0D8]/60 dark:bg-[#292524] text-[#716D67] dark:text-[#A8A29E]">
                {reportAnalytics.submissions?.length || 0} Submissions
              </span>
            </div>

            {/* Mobile Stacked Card View (< 768px): 100% visible at a single glance without horizontal scrolling */}
            <div className="block md:hidden divide-y divide-[#E5E0D8] dark:divide-[#292524]">
              {reportAnalytics.submissions && reportAnalytics.submissions.length > 0 ? (
                reportAnalytics.submissions.map((sub: any) => (
                  <div key={sub.submission_id} className="py-3.5 space-y-2.5 first:pt-0 last:pb-0">
                    {/* Top Row: Rank, Student Name, Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-xs bg-[#FAF8F5] dark:bg-[#201D1A] border border-[#E5E0D8] dark:border-[#292524] px-2 py-0.5 rounded-md text-[#C84B18] dark:text-[#EA580C] shrink-0">
                          #{sub.rank}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-[#242321] dark:text-[#F5F5F4] truncate">
                            {sub.student_name}
                          </div>
                          <div className="text-[10px] text-[#716D67] dark:text-[#A8A29E] truncate">
                            {sub.email}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          sub.is_passed
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                        }`}
                      >
                        {sub.is_passed ? "PASSED" : "FAILED"}
                      </span>
                    </div>

                    {/* Middle Row: Score, Percentage, Roll Number, Proctor Flags */}
                    <div className="grid grid-cols-2 gap-2 bg-[#FAF8F5] dark:bg-[#141312] p-2.5 rounded-xl border border-[#E5E0D8]/70 dark:border-[#292524] text-[11px]">
                      <div>
                        <span className="text-[10px] text-[#716D67] dark:text-[#A8A29E] block">Score</span>
                        <span className="font-bold text-[#242321] dark:text-[#F5F5F4]">
                          {formatNum(sub.score)} / {formatNum(sub.max_score)}
                        </span>{" "}
                        <span className="font-bold text-[#C84B18] dark:text-[#EA580C]">
                          ({formatNum(sub.percentage)}%)
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-[#716D67] dark:text-[#A8A29E] block">Roll Number</span>
                        <span className="font-mono text-[#242321] dark:text-[#F5F5F4] break-all">
                          {sub.roll_number || "N/A"}
                        </span>
                      </div>

                      <div className="col-span-2 flex items-center justify-between pt-1.5 border-t border-[#E5E0D8]/50 dark:border-[#292524]">
                        <span className="text-[10px] text-[#716D67] dark:text-[#A8A29E]">Proctor Audit:</span>
                        {sub.proctor_alerts > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 text-[10px] font-semibold border border-rose-200">
                            {sub.proctor_alerts} Incident{sub.proctor_alerts > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            Clean Attempt
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Row */}
                    <button
                      type="button"
                      onClick={() => inspectStudentAnswerSheet(sub.submission_id)}
                      className="w-full py-2 px-3 rounded-lg border border-[#E5E0D8] dark:border-[#292524] bg-white dark:bg-[#171615] hover:bg-[#FAF8F5] text-[#716D67] hover:text-[#C84B18] text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>View Answer Sheet & Proctor Audit</span>
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-[#716D67]">
                  No student attempts submitted for this quiz yet.
                </div>
              )}
            </div>

            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[620px]">
                <thead>
                  <tr className="border-b border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E]">
                    <th className="py-2.5 px-3 font-semibold">Rank</th>
                    <th className="py-2.5 px-3 font-semibold">Candidate</th>
                    <th className="py-2.5 px-3 font-semibold">Roll Number</th>
                    <th className="py-2.5 px-3 font-semibold">Score</th>
                    <th className="py-2.5 px-3 font-semibold">Percentage</th>
                    <th className="py-2.5 px-3 font-semibold">Result</th>
                    <th className="py-2.5 px-3 font-semibold">Proctor Flags</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E0D8] dark:divide-[#292524]">
                  {reportAnalytics.submissions && reportAnalytics.submissions.length > 0 ? (
                    reportAnalytics.submissions.map((sub: any) => (
                      <tr
                        key={sub.submission_id}
                        className="hover:bg-[#F0ECE4]/30 dark:hover:bg-[#1D1B19]/30 transition-colors"
                      >
                        <td className="py-3 px-3 font-bold font-mono">#{sub.rank}</td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-[#242321] dark:text-[#F5F5F4]">{sub.student_name}</div>
                          <div className="text-[11px] text-[#716D67]">{sub.email}</div>
                        </td>
                        <td className="py-3 px-3 font-mono text-[#716D67]">{sub.roll_number || "N/A"}</td>
                        <td className="py-3 px-3 font-bold text-[#242321] dark:text-[#F5F5F4]">
                          {formatNum(sub.score)} / {formatNum(sub.max_score)}
                        </td>
                        <td className="py-3 px-3 font-bold text-[#C84B18] dark:text-[#EA580C]">{formatNum(sub.percentage)}%</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sub.is_passed
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                            }`}
                          >
                            {sub.is_passed ? "PASSED" : "FAILED"}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {sub.proctor_alerts > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 text-[10px] font-semibold border border-rose-200">
                              {sub.proctor_alerts} Incident{sub.proctor_alerts > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Clean
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => inspectStudentAnswerSheet(sub.submission_id)}
                            className="px-2.5 py-1 rounded border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#C84B18] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] text-[11px] font-semibold transition-all"
                          >
                            View Sheet
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-[#716D67]">
                        No student attempts submitted for this quiz yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* ═══════ STUDENT ANSWER SHEET INSPECTION MODAL ═══════ */}
      {studentAnswerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E0D8] dark:border-[#292524] pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] rounded-lg">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#242321] dark:text-[#F5F5F4]">
                    Candidate Evaluation Sheet — {studentAnswerModal.student_name}
                  </h3>
                  <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                    Exam: <b>{studentAnswerModal.exam_name}</b> | Roll:{" "}
                    <b>{studentAnswerModal.roll_number || "N/A"}</b> | Score:{" "}
                    <b className="text-[#C84B18]">
                      {studentAnswerModal.score} / {studentAnswerModal.max_score} ({studentAnswerModal.percentage}%)
                    </b>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`${API_V1}/reports/submission-detail/${studentAnswerModal.submission_id}/printable`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#C84B18]/10 text-[#C84B18] hover:bg-[#C84B18]/20 font-bold text-xs flex items-center gap-1.5 transition-all"
                  title="Open Official Student Response Booklet (PDF/Print)"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Print Response Sheet</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                <button
                  onClick={() => setStudentAnswerModal(null)}
                  className="p-1.5 rounded-lg text-[#716D67] hover:bg-[#E5E0D8]/50 dark:hover:bg-[#292524]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Questions Breakdown List */}
            <div className="overflow-y-auto space-y-4 pr-1 text-xs">
              {studentAnswerModal.questions && studentAnswerModal.questions.length > 0 ? (
                studentAnswerModal.questions.map((q: any, idx: number) => {
                  const isCorrect = q.is_correct;
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                        isCorrect
                          ? "bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50"
                          : "bg-rose-50/30 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-[#716D67]">
                          Q{idx + 1}. {q.question_text || q.question}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {q.score_awarded ?? (isCorrect ? q.marks : 0)} / {q.marks || 1}
                        </span>
                      </div>

                      <div className="pl-4 space-y-1.5 text-[11px]">
                        <div>
                          <b>Student Response:</b>{" "}
                          <span className="font-mono text-[#242321] dark:text-[#F5F5F4]">
                            {String(q.user_answer_text || q.user_answer || "No response provided.")}
                          </span>
                        </div>
                        <div>
                          <b>Correct Answer:</b>{" "}
                          <span className="font-mono text-emerald-700 dark:text-emerald-300 font-bold">
                            {String(q.correct_answer_text || q.correct_answer)}
                          </span>
                        </div>
                        {q.ai_feedback && (
                          <div className="text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md mt-1 border border-amber-200">
                            <b>AI Evaluator Feedback:</b> {q.ai_feedback}
                          </div>
                        )}
                        {q.explanation && (
                          <div className="text-[#716D67] pt-1">
                            <b>Explanation:</b> {q.explanation}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-[#716D67]">No question evaluations found.</div>
              )}
            </div>

            <div className="pt-3 border-t border-[#E5E0D8] dark:border-[#292524] flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 sm:gap-0 shrink-0">
              <a
                href={`${API_V1}/reports/submission-detail/${studentAnswerModal.submission_id}/printable`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#C84B18] font-bold hover:underline flex items-center gap-1"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Open Full Printable Answer Booklet</span>
              </a>
              <button onClick={() => setStudentAnswerModal(null)} className="btn-primary px-5">
                Close Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

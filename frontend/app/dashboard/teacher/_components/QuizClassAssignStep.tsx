"use client";

import { useState, useEffect } from "react";
import { 
  Users, GraduationCap, Building2, CheckCircle2, UserCheck, 
  Sparkles, FolderPlus, Layers, Globe 
} from "lucide-react";
import { fetchCohorts } from "../../../../lib/api/academic";
import { fetchAssessmentGroups, createAssessmentGroup } from "../../../../lib/api/assessmentGroups";
import { apiFetch } from "../../../../lib/api";
import { useAuthStore } from "../../../../store/authStore";
import { Cohort, AssessmentGroup } from "../../../../types/academic";

interface QuizClassAssignStepProps {
  examId: string;
  onAssigned: (groupName: string, eligibleCount: number) => void;
}

export default function QuizClassAssignStep({ examId, onAssigned }: QuizClassAssignStepProps) {
  const { token } = useAuthStore();

  const [assignMode, setAssignMode] = useState<"ALL" | "DEPARTMENT" | "COHORT" | "CUSTOM">("COHORT");
  
  // Departments State
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  // Cohorts State
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);

  // Custom Groups State
  const [customGroups, setCustomGroups] = useState<AssessmentGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState("");

  // Student Pickers for Custom Group
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  
  // Preview State
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadDepartmentsList();
    loadCohortsList();
    loadCustomGroupsList();
    loadStudentsList();
  }, [token]);

  const loadDepartmentsList = async () => {
    try {
      const res = await apiFetch("/institutions/departments", { token });
      if (res.ok) setDepartments(await res.json());
    } catch {}
  };

  const loadCohortsList = async () => {
    const data = await fetchCohorts(token);
    setCohorts(data);
  };

  const loadCustomGroupsList = async () => {
    const data = await fetchAssessmentGroups(token);
    setCustomGroups(data);
  };

  const loadStudentsList = async () => {
    try {
      const res = await apiFetch("/students/", { token });
      if (res.ok) {
        const data = await res.json();
        setAllStudents(data.items || (Array.isArray(data) ? data : []));
      }
    } catch {}
  };

  // Assign Open Enrollment (All Students)
  const handleAssignAllStudents = async () => {
    setLoading(true);
    try {
      // Clear specific targets in settings_json or targets
      const count = allStudents.length;
      setEligibleCount(count);
      onAssigned("All Enrolled Students", count);
    } finally {
      setLoading(false);
    }
  };

  // Assign Specific Department
  const handleAssignDepartment = async (dept: any) => {
    setSelectedDeptId(dept.id);
    setLoading(true);
    try {
      // Find students in this department
      const matchingCount = allStudents.filter((s) => s.department_name === dept.name || s.department_id === dept.id).length;
      
      // Save target settings to exam
      await apiFetch(`/exams/${examId}`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          settings_json: JSON.stringify({ target_department_ids: [dept.id] })
        })
      }).catch(() => {});

      setEligibleCount(matchingCount);
      onAssigned(`Department: ${dept.name}`, matchingCount);
    } finally {
      setLoading(false);
    }
  };

  // Assign Existing Cohort
  const handleAssignCohort = async (cohort: Cohort) => {
    setSelectedCohortId(cohort.id);
    setLoading(true);
    try {
      // 1. Create/find COHORT assessment group
      const grp = await createAssessmentGroup(token, {
        name: `Class ${cohort.name}`,
        type: "COHORT",
        cohort_id: cohort.id,
      });

      if (grp) {
        // 2. Link target to exam
        const targetRes = await apiFetch(`/exams/${examId}/targets`, {
          method: "POST",
          token,
          body: JSON.stringify({ assessment_group_id: grp.id }),
        });

        if (targetRes.ok) {
          const tData = await targetRes.json();
          setEligibleCount(tData.eligible_count);
          onAssigned(cohort.name, tData.eligible_count);
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  // Create & Assign Custom Group
  const handleCreateAndAssignCustomGroup = async () => {
    if (!newGroupName.trim() || selectedStudentIds.length === 0) return;
    setLoading(true);
    try {
      const grp = await createAssessmentGroup(token, {
        name: newGroupName,
        type: "CUSTOM",
        student_ids: selectedStudentIds,
      });

      if (grp) {
        const targetRes = await apiFetch(`/exams/${examId}/targets`, {
          method: "POST",
          token,
          body: JSON.stringify({ assessment_group_id: grp.id }),
        });

        if (targetRes.ok) {
          const tData = await targetRes.json();
          setEligibleCount(tData.eligible_count);
          onAssigned(newGroupName, tData.eligible_count);
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 bg-white dark:bg-[#171615] p-6 rounded-2xl border border-[#E5E0D8] dark:border-[#292524] shadow-xs">
      <div>
        <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2">
          <Users className="w-5 h-5 text-[#C84B18]" />
          <span>Select Target Audience & Examination Placement</span>
        </h3>
        <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-0.5">
          Selectively generate and dispatch credentials only to eligible departments, classes, or students.
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={() => {
            setAssignMode("ALL");
            handleAssignAllStudents();
          }}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            assignMode === "ALL"
              ? "border-[#C84B18] bg-[#C84B18]/5 text-[#242321] dark:text-[#F5F5F4] font-semibold"
              : "border-[#E5E0D8] dark:border-[#292524] hover:bg-[#F7F4EF] dark:hover:bg-[#141312] text-[#716D67]"
          }`}
        >
          <Globe className="w-4 h-4 mb-1.5 text-[#C84B18]" />
          <div className="text-xs font-bold">All Students</div>
          <div className="text-[11px] text-[#716D67]">Open enrollment for entire institution</div>
        </button>

        <button
          type="button"
          onClick={() => setAssignMode("DEPARTMENT")}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            assignMode === "DEPARTMENT"
              ? "border-[#C84B18] bg-[#C84B18]/5 text-[#242321] dark:text-[#F5F5F4] font-semibold"
              : "border-[#E5E0D8] dark:border-[#292524] hover:bg-[#F7F4EF] dark:hover:bg-[#141312] text-[#716D67]"
          }`}
        >
          <Building2 className="w-4 h-4 mb-1.5 text-[#C84B18]" />
          <div className="text-xs font-bold">By Department</div>
          <div className="text-[11px] text-[#716D67]">Target specific academic department</div>
        </button>

        <button
          type="button"
          onClick={() => setAssignMode("COHORT")}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            assignMode === "COHORT"
              ? "border-[#C84B18] bg-[#C84B18]/5 text-[#242321] dark:text-[#F5F5F4] font-semibold"
              : "border-[#E5E0D8] dark:border-[#292524] hover:bg-[#F7F4EF] dark:hover:bg-[#141312] text-[#716D67]"
          }`}
        >
          <GraduationCap className="w-4 h-4 mb-1.5 text-[#C84B18]" />
          <div className="text-xs font-bold">By Class / Cohort</div>
          <div className="text-[11px] text-[#716D67]">Target specific class & division</div>
        </button>

        <button
          type="button"
          onClick={() => setAssignMode("CUSTOM")}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            assignMode === "CUSTOM"
              ? "border-[#C84B18] bg-[#C84B18]/5 text-[#242321] dark:text-[#F5F5F4] font-semibold"
              : "border-[#E5E0D8] dark:border-[#292524] hover:bg-[#F7F4EF] dark:hover:bg-[#141312] text-[#716D67]"
          }`}
        >
          <FolderPlus className="w-4 h-4 mb-1.5 text-[#C84B18]" />
          <div className="text-xs font-bold">Custom Group</div>
          <div className="text-[11px] text-[#716D67]">Hand-pick individual candidates</div>
        </button>
      </div>

      {/* Mode 1: Department Selective Targeting */}
      {assignMode === "DEPARTMENT" && (
        <div className="space-y-3 pt-2 animate-fadeIn">
          <div className="text-xs font-bold uppercase text-[#716D67] tracking-wider">
            Select Eligible Academic Department
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {departments.map((d) => (
              <div
                key={d.id}
                onClick={() => handleAssignDepartment(d)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  selectedDeptId === d.id
                    ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500"
                    : "border-[#E5E0D8] dark:border-[#292524] hover:border-[#C84B18]"
                }`}
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-xs text-[#242321] dark:text-[#F5F5F4]">{d.name}</div>
                  <div className="text-[11px] text-[#716D67]">{d.student_count || 0} registered candidates</div>
                </div>
                {selectedDeptId === d.id && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode 2: Class & Cohorts Selective Targeting */}
      {assignMode === "COHORT" && (
        <div className="space-y-3 pt-2 animate-fadeIn">
          <div className="text-xs font-bold uppercase text-[#716D67] tracking-wider">
            Select Eligible Class & Cohort
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {cohorts.map((c) => (
              <div
                key={c.id}
                onClick={() => handleAssignCohort(c)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  selectedCohortId === c.id
                    ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500"
                    : "border-[#E5E0D8] dark:border-[#292524] hover:border-[#C84B18]"
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-[#242321] dark:text-[#F5F5F4]">{c.name}</div>
                  <div className="text-[11px] text-[#716D67]">Year {c.year_number} • Div {c.division}</div>
                </div>
                <span className="px-2.5 py-0.5 bg-[#C84B18]/10 text-[#C84B18] text-xs font-bold rounded-full">
                  {c.student_count || 0} Candidates
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode 3: Custom Student Pickers */}
      {assignMode === "CUSTOM" && (
        <div className="space-y-3 pt-2 animate-fadeIn">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#716D67] block">Class / Group Name</label>
            <input
              type="text"
              placeholder="e.g. Unit 3 Remedial Group"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#716D67] block">
              Select Candidates ({selectedStudentIds.length} Selected)
            </label>
            <div className="max-h-52 overflow-y-auto border border-[#E5E0D8] dark:border-[#292524] rounded-xl divide-y divide-[#E5E0D8] dark:divide-[#292524] p-1.5">
              {allStudents.map((s) => {
                const isSel = selectedStudentIds.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedStudentIds(isSel ? selectedStudentIds.filter((id) => id !== s.id) : [...selectedStudentIds, s.id]);
                    }}
                    className={`p-2 rounded-lg flex items-center justify-between cursor-pointer text-xs ${
                      isSel ? "bg-[#C84B18]/10 text-[#C84B18] font-bold" : "hover:bg-[#F7F4EF] dark:hover:bg-[#141312]"
                    }`}
                  >
                    <div>
                      <span>{s.full_name}</span>
                      <span className="text-[11px] text-[#716D67] ml-2">({s.roll_number})</span>
                    </div>
                    {isSel && <CheckCircle2 className="w-3.5 h-3.5 text-[#C84B18]" />}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            disabled={!newGroupName.trim() || selectedStudentIds.length === 0 || loading}
            onClick={handleCreateAndAssignCustomGroup}
            className="w-full py-2.5 btn-primary text-xs font-bold shadow-xs disabled:opacity-50"
          >
            Assign Custom Group ({selectedStudentIds.length} Candidates)
          </button>
        </div>
      )}

      {/* Eligible Candidate Preview Confirmation */}
      {eligibleCount !== null && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-center justify-between text-emerald-900 dark:text-emerald-200 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-xs">Targeting Confirmed</span>
          </div>
          <span className="text-xs font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-2.5 py-0.5 rounded-full">
            {eligibleCount} Eligible Candidates
          </span>
        </div>
      )}
    </div>
  );
}

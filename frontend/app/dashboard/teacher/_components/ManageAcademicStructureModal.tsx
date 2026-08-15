"use client";

import { useState, useEffect } from "react";
import { 
  X, Building2, GraduationCap, Plus, Trash2, CheckCircle2, 
  Users, Sparkles, Layers, ArrowRight, Loader2, RefreshCw 
} from "lucide-react";
import { apiFetch } from "../../../../lib/api";
import { useAuthStore } from "../../../../store/authStore";
import { useToast } from "../../../../components/Toast";

interface ManageAcademicStructureModalProps {
  onClose: () => void;
  onRefreshStructure: () => void;
  onFilterToClass?: (deptId: string | null, cohortId: string | null) => void;
}

const POPULAR_DEPARTMENT_PRESETS = [
  { name: "Computer Science & Engineering", icon: "💻", color: "blue" },
  { name: "Electrical & Electronics Engineering", icon: "⚡", color: "amber" },
  { name: "Mechanical Engineering", icon: "⚙️", color: "purple" },
  { name: "Business Administration & Management", icon: "📊", color: "emerald" },
  { name: "Biotechnology & Life Sciences", icon: "🧬", color: "teal" },
  { name: "Applied Mathematics & Statistics", icon: "📐", color: "indigo" },
  { name: "Physics & Material Sciences", icon: "⚛️", color: "rose" },
];

export default function ManageAcademicStructureModal({
  onClose,
  onRefreshStructure,
  onFilterToClass,
}: ManageAcademicStructureModalProps) {
  const { token } = useAuthStore();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"departments" | "classes">("departments");
  const [departments, setDepartments] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Department creation states
  const [newDeptName, setNewDeptName] = useState("");
  const [isCreatingDept, setIsCreatingDept] = useState(false);
  const [deletingDeptId, setDeletingDeptId] = useState<string | null>(null);

  // Class creation states
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [className, setClassName] = useState("");
  const [selectedDivision, setSelectedDivision] = useState<string>("A");
  const [batchYear, setBatchYear] = useState<string>("2026");
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/academic/classes/summary", { token });
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments || []);
        setClasses(data.classes || []);
        if (data.departments?.length > 0 && !selectedDeptId) {
          setSelectedDeptId(data.departments[0].id);
        }
      }
    } catch {
      showToast("Network error fetching academic structure", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSummary();
    }
  }, [token]);

  // Action: Add Department
  const handleAddDepartment = async (nameToAdd?: string) => {
    const name = (nameToAdd || newDeptName).trim();
    if (!name) return;

    setIsCreatingDept(true);
    try {
      const res = await apiFetch("/institutions/departments", {
        method: "POST",
        token,
        body: JSON.stringify({ name }),
      });

      if (res.ok) {
        showToast(`Department '${name}' added successfully!`, "success");
        setNewDeptName("");
        fetchSummary();
        onRefreshStructure();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Failed to add department", "error");
      }
    } catch {
      showToast("Network error adding department", "error");
    } finally {
      setIsCreatingDept(false);
    }
  };

  // Action: Delete Department
  const handleDeleteDepartment = async (deptId: string) => {
    try {
      const res = await apiFetch(`/institutions/departments/${deptId}`, {
        method: "DELETE",
        token,
      });
      if (res.ok) {
        showToast("Department removed", "success");
        setDeletingDeptId(null);
        fetchSummary();
        onRefreshStructure();
      } else {
        showToast("Failed to delete department", "error");
      }
    } catch {
      showToast("Network error deleting department", "error");
    }
  };

  // Action: Add Class
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId) {
      showToast("Please select a department for this class", "error");
      return;
    }

    setIsCreatingClass(true);
    try {
      const res = await apiFetch("/academic/classes", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: className.trim() || `Class - Div ${selectedDivision}`,
          department_id: selectedDeptId,
          division: selectedDivision,
          batch_year: batchYear,
        }),
      });

      if (res.ok) {
        showToast("New academic class & cohort created!", "success");
        setClassName("");
        fetchSummary();
        onRefreshStructure();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Failed to create class", "error");
      }
    } catch {
      showToast("Network error creating class", "error");
    } finally {
      setIsCreatingClass(false);
    }
  };

  // Action: Delete Class
  const handleDeleteClass = async (cohortId: string) => {
    try {
      const res = await apiFetch(`/academic/classes/${cohortId}`, {
        method: "DELETE",
        token,
      });
      if (res.ok) {
        showToast("Class removed", "success");
        setDeletingClassId(null);
        fetchSummary();
        onRefreshStructure();
      } else {
        showToast("Failed to delete class", "error");
      }
    } catch {
      showToast("Network error deleting class", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] rounded-xl border border-[#C84B18]/20">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">
                Manage Academic Structure
              </h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                Configure Departments, Degree Programs, and Class Cohorts for selective examination targeting.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#716D67] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524] transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 bg-[#F7F4EF] dark:bg-[#141312] p-1 rounded-xl border border-[#E5E0D8] dark:border-[#292524] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("departments")}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === "departments"
                ? "bg-white dark:bg-[#1D1B19] text-[#242321] dark:text-[#F5F5F4] shadow-xs"
                : "text-[#716D67] hover:text-[#242321]"
            }`}
          >
            <Building2 className="h-4 w-4 text-[#C84B18]" />
            <span>Departments ({departments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("classes")}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === "classes"
                ? "bg-white dark:bg-[#1D1B19] text-[#242321] dark:text-[#F5F5F4] shadow-xs"
                : "text-[#716D67] hover:text-[#242321]"
            }`}
          >
            <GraduationCap className="h-4 w-4 text-[#C84B18]" />
            <span>Classes & Cohorts ({classes.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {loading ? (
            <div className="py-16 text-center space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin text-[#C84B18] mx-auto" />
              <p className="text-xs text-[#716D67]">Loading academic registry...</p>
            </div>
          ) : activeTab === "departments" ? (
            /* ═══════ TAB 1: DEPARTMENTS ═══════ */
            <div className="space-y-5">
              {/* Quick 1-Click Popular Presets */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#C84B18]" />
                  <span>1-Click Popular Department Presets:</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_DEPARTMENT_PRESETS.map((preset, idx) => {
                    const alreadyExists = departments.some(
                      (d) => d.name.toLowerCase() === preset.name.toLowerCase()
                    );
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={alreadyExists || isCreatingDept}
                        onClick={() => handleAddDepartment(preset.name)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                          alreadyExists
                            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-700 dark:text-emerald-400 opacity-60 cursor-default"
                            : "bg-[#F7F4EF] dark:bg-[#141312] border-[#E5E0D8] dark:border-[#292524] text-[#242321] dark:text-[#F5F5F4] hover:border-[#C84B18] hover:bg-[#C84B18]/5"
                        }`}
                      >
                        <span>{preset.icon}</span>
                        <span>{preset.name}</span>
                        {alreadyExists && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Add Form */}
              <div className="bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-3.5 space-y-2">
                <label className="block text-xs font-semibold text-[#242321] dark:text-[#F5F5F4]">
                  Add Custom Department
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="e.g. Civil & Environmental Engineering"
                    className="flex-1 bg-white dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] rounded-lg px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:ring-1 focus:ring-[#C84B18]"
                  />
                  <button
                    type="button"
                    disabled={!newDeptName.trim() || isCreatingDept}
                    onClick={() => handleAddDepartment()}
                    className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    {isCreatingDept ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    <span>Add Department</span>
                  </button>
                </div>
              </div>

              {/* Existing Departments List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#716D67] uppercase tracking-wider">
                  Active Departments ({departments.length})
                </h4>
                {departments.length === 0 ? (
                  <div className="p-8 text-center border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs text-[#716D67]">
                    No departments created yet. Click a preset above or type a name to add your first department.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {departments.map((dept) => (
                      <div
                        key={dept.id}
                        className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-bold text-xs text-[#242321] dark:text-[#F5F5F4] truncate">
                            {dept.name}
                          </div>
                          <div className="text-[11px] text-[#716D67] flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{dept.student_count || 0} enrolled candidates</span>
                          </div>
                        </div>

                        {deletingDeptId === dept.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteDepartment(dept.id)}
                              className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingDeptId(null)}
                              className="px-1.5 py-1 text-[10px] text-[#716D67]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeletingDeptId(dept.id)}
                            className="p-1.5 text-[#716D67] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors"
                            title="Remove Department"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ═══════ TAB 2: CLASSES & DIVISIONS ═══════ */
            <div className="space-y-5">
              {/* Add Class Form */}
              <form onSubmit={handleAddClass} className="bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-4 space-y-3">
                <div className="font-bold text-xs text-[#242321] dark:text-[#F5F5F4]">
                  Create New Class / Cohort
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#716D67] dark:text-[#A8A29E] mb-1">
                      Department *
                    </label>
                    <select
                      required
                      value={selectedDeptId}
                      onChange={(e) => setSelectedDeptId(e.target.value)}
                      className="w-full bg-white dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] rounded-lg px-2.5 py-2 text-xs text-[#242321] dark:text-[#F5F5F4]"
                    >
                      <option value="">Select Department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#716D67] dark:text-[#A8A29E] mb-1">
                      Class Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      placeholder="e.g. 3rd Year CS"
                      className="w-full bg-white dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] rounded-lg px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#716D67] dark:text-[#A8A29E] mb-1">
                      Division
                    </label>
                    <div className="flex items-center gap-1.5">
                      {["A", "B", "C", "D"].map((div) => (
                        <button
                          key={div}
                          type="button"
                          onClick={() => setSelectedDivision(div)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            selectedDivision === div
                              ? "bg-[#C84B18] text-white border-[#C84B18]"
                              : "bg-white dark:bg-[#1D1B19] border-[#E5E0D8] dark:border-[#292524] text-[#716D67]"
                          }`}
                        >
                          Div {div}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#716D67] dark:text-[#A8A29E] mb-1">
                      Batch Year
                    </label>
                    <input
                      type="text"
                      value={batchYear}
                      onChange={(e) => setBatchYear(e.target.value)}
                      placeholder="2026"
                      className="w-full bg-white dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] rounded-lg px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4]"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isCreatingClass}
                    className="btn-primary py-2 px-5 text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    {isCreatingClass ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    <span>Create Class</span>
                  </button>
                </div>
              </form>

              {/* Existing Classes List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#716D67] uppercase tracking-wider">
                  Active Classes & Cohorts ({classes.length})
                </h4>
                {classes.length === 0 ? (
                  <div className="p-8 text-center border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs text-[#716D67]">
                    No classes configured yet. Fill the form above to add your first class cohort.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {classes.map((cls) => (
                      <div
                        key={cls.id}
                        className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-xs hover:border-[#C84B18]/40 transition-all"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[#242321] dark:text-[#F5F5F4]">
                              {cls.name}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[#C84B18]/10 text-[#C84B18] font-bold text-[10px]">
                              Div {cls.division}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#716D67]">
                            Department: <b>{cls.department_name}</b> • {cls.student_count || 0} enrolled students
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {onFilterToClass && (
                            <button
                              type="button"
                              onClick={() => {
                                onFilterToClass(cls.department_id, cls.id);
                                onClose();
                              }}
                              className="px-2.5 py-1 rounded-lg border border-[#E5E0D8] dark:border-[#292524] text-[11px] font-semibold text-[#716D67] hover:text-[#C84B18] hover:bg-white dark:hover:bg-[#292524] transition-all flex items-center gap-1"
                              title="Filter main Student Directory to this class"
                            >
                              <span>View Students</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          )}

                          {deletingClassId === cls.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteClass(cls.id)}
                                className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingClassId(null)}
                                className="px-1.5 py-1 text-[10px] text-[#716D67]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeletingClassId(cls.id)}
                              className="p-1.5 text-[#716D67] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors"
                              title="Remove Class"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end shrink-0 pt-3 border-t border-[#E5E0D8] dark:border-[#292524]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-xs font-semibold text-[#716D67] hover:text-[#242321] dark:hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

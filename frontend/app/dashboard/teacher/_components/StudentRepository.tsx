"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Users, Search, Filter, ChevronRight, GraduationCap, Building2, 
  BookOpen, Calendar, ArrowLeft, RefreshCw, Plus, Upload, CheckCircle2,
  Mail, ShieldAlert, KeyRound, AlertCircle, Sparkles, X, Trash2, Pencil, 
  Clock, Copy, Link, Download, CheckSquare, Square, ChevronDown, Eye, Loader2
} from "lucide-react";
import { API_V1, apiFetch } from "../../../../lib/api";
import { useAuthStore } from "../../../../store/authStore";
import { useToast } from "../../../../components/Toast";
import { fetchAcademicSessions, fetchCohorts } from "../../../../lib/api/academic";
import { Cohort, AcademicSession } from "../../../../types/academic";
import EditStudentModal from "./EditStudentModal";
import StudentOverviewDrawer from "./StudentOverviewDrawer";
import CSVImportModal from "./CSVImportModal";
import ManageAcademicStructureModal from "./ManageAcademicStructureModal";

interface StudentRepositoryProps {
  onOpenImportModal?: () => void;
  onOpenAddModal?: () => void;
}

export default function StudentRepository({ onOpenImportModal, onOpenAddModal }: StudentRepositoryProps) {
  const { token } = useAuthStore();
  const { showToast } = useToast();

  // Structure Modal State
  const [showStructureModal, setShowStructureModal] = useState(false);

  // Directory Hierarchy States
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);

  // Student Roster States
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "authorized" | "pending">("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Advanced Filter Dropdowns Toggle
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Multi-Selection State
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Modal & Drawer States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [inspectingStudentId, setInspectingStudentId] = useState<string | null>(null);

  // Form States for Add Student
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [division, setDivision] = useState("A");
  const [departmentId, setDepartmentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load initial hierarchy data
  useEffect(() => {
    if (!token) return;
    loadDepartments();
    loadSessions();
  }, [token]);

  const loadDepartments = async () => {
    try {
      const res = await apiFetch("/institutions/departments", { token });
      if (res.ok) setDepartments(await res.json());
    } catch {}
  };

  const loadSessions = async () => {
    const data = await fetchAcademicSessions(token);
    setSessions(data);
    if (data.length > 0) setSelectedSessionId(data[0].id);
  };

  useEffect(() => {
    if (!token) return;
    loadCohortList();
  }, [token, selectedSessionId]);

  const loadCohortList = async () => {
    const data = await fetchCohorts(token, {
      academic_session_id: selectedSessionId || undefined,
    });
    setCohorts(data);
  };

  // Fetch paginated student list
  const fetchStudentsList = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("page_size", String(pageSize));
      if (search) params.append("search", search);
      if (selectedDeptId) params.append("department_id", selectedDeptId);
      if (selectedCohortId) params.append("cohort_id", selectedCohortId);

      const res = await apiFetch(`/students/?${params.toString()}`, { token });
      if (res.ok) {
        const data = await res.json();
        if (data.items) {
          setStudents(data.items);
          setTotalPages(data.total_pages || 1);
          setTotalStudents(data.total || data.items.length);
        } else if (Array.isArray(data)) {
          setStudents(data);
          setTotalStudents(data.length);
          setTotalPages(1);
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentsList();
  }, [token, page, search, selectedDeptId, selectedCohortId]);

  // Derived KPI Metrics
  const kpiStats = useMemo(() => {
    const total = students.length;
    const authorized = students.filter((s) => s.is_verified).length;
    const pending = total - authorized;
    return { total, authorized, pending };
  }, [students]);

  // Filtered Students for UI view
  const displayedStudents = useMemo(() => {
    if (statusFilter === "authorized") return students.filter((s) => s.is_verified);
    if (statusFilter === "pending") return students.filter((s) => !s.is_verified);
    return students;
  }, [students, statusFilter]);

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === displayedStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(displayedStudents.map((s) => s.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Action: Add Student
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !rollNumber) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch("/students", {
        method: "POST",
        token,
        body: JSON.stringify({
          full_name: fullName,
          email,
          roll_number: rollNumber,
          department_id: departmentId || selectedDeptId || undefined,
          division: division || "A",
        }),
      });

      if (res.ok) {
        showToast("Student enrolled successfully! Authorization invite queued.", "success");
        setFullName("");
        setEmail("");
        setRollNumber("");
        setShowAddModal(false);
        fetchStudentsList();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Failed to add student", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Instant Authorize
  const handleInstantAuthorize = async (studentId: string, studentName: string) => {
    try {
      const res = await apiFetch(`/students/${studentId}/instant-authorize`, {
        method: "POST",
        token,
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`Instant authorization successful for ${studentName}! Password: ${data.generated_password}`, "success");
        fetchStudentsList();
      } else {
        showToast("Failed to authorize student", "error");
      }
    } catch {
      showToast("Network error during authorization", "error");
    }
  };

  // Action: Resend Auth Email
  const handleResendAuth = async (studentId: string, email: string) => {
    try {
      const res = await apiFetch(`/students/${studentId}/resend-auth`, { method: "POST", token });
      if (res.ok) {
        showToast(`Authorization invite email dispatched to ${email}`, "success");
      } else {
        showToast("Failed to send authorization email", "error");
      }
    } catch {
      showToast("Network error", "error");
    }
  };

  // Action: Copy Auth Link
  const handleCopyAuthLink = (url?: string) => {
    if (!url) {
      showToast("No authorization link available for this candidate", "error");
      return;
    }
    navigator.clipboard.writeText(url);
    showToast("Authorization link copied to clipboard!", "success");
  };

  // Action: Delete Single Student
  const handleDelete = async (studentId: string) => {
    try {
      const res = await apiFetch(`/students/${studentId}`, { method: "DELETE", token });
      if (res.ok) {
        showToast("Student profile removed", "success");
        setDeletingId(null);
        fetchStudentsList();
      } else {
        showToast("Failed to delete student", "error");
      }
    } catch {
      showToast("Network error", "error");
    }
  };

  // Action: Bulk Authorize
  const handleBulkAuthorize = async () => {
    if (selectedStudentIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      const res = await apiFetch("/students/bulk-authorize", {
        method: "POST",
        token,
        body: JSON.stringify({ student_ids: selectedStudentIds }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`Bulk authorized ${data.authorized_count || selectedStudentIds.length} students!`, "success");
        setSelectedStudentIds([]);
        fetchStudentsList();
      } else {
        showToast("Failed to bulk authorize selected students", "error");
      }
    } catch {
      showToast("Network error during bulk authorization", "error");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Action: Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedStudentIds.length === 0) return;
    if (!confirm(`Are you sure you want to remove ${selectedStudentIds.length} selected students?`)) return;

    setIsBulkProcessing(true);
    try {
      const res = await apiFetch("/students/bulk-delete", {
        method: "POST",
        token,
        body: JSON.stringify({ student_ids: selectedStudentIds }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`Removed ${data.deleted_count || selectedStudentIds.length} student profiles`, "success");
        setSelectedStudentIds([]);
        fetchStudentsList();
      } else {
        showToast("Failed to delete selected students", "error");
      }
    } catch {
      showToast("Network error during bulk delete", "error");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ═══════ 1. KPI SUMMARY METRIC CARDS ═══════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Enrolled */}
        <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">
              Total Enrolled
            </span>
            <div className="text-2xl font-bold text-[#242321] dark:text-[#F5F5F4]">
              {totalStudents}
            </div>
            <p className="text-[11px] text-[#716D67]">Registered candidates</p>
          </div>
          <div className="p-3 bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] rounded-2xl">
            <Users className="h-6 w-6" />
          </div>
        </div>

        {/* Authorized & Active */}
        <div 
          onClick={() => setStatusFilter("authorized")}
          className={`bg-white dark:bg-[#171615] border rounded-2xl p-5 shadow-xs flex items-center justify-between cursor-pointer transition-all ${
            statusFilter === "authorized" 
              ? "border-emerald-500 ring-2 ring-emerald-500/20" 
              : "border-[#E5E0D8] dark:border-[#292524] hover:border-emerald-300"
          }`}
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Authorized (Active)
            </span>
            <div className="text-2xl font-bold text-[#242321] dark:text-[#F5F5F4]">
              {kpiStats.authorized}
            </div>
            <p className="text-[11px] text-[#716D67]">Password active & verified</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>

        {/* Pending Authorization */}
        <div 
          onClick={() => setStatusFilter("pending")}
          className={`bg-white dark:bg-[#171615] border rounded-2xl p-5 shadow-xs flex items-center justify-between cursor-pointer transition-all ${
            statusFilter === "pending" 
              ? "border-amber-500 ring-2 ring-amber-500/20" 
              : "border-[#E5E0D8] dark:border-[#292524] hover:border-amber-300"
          }`}
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> Pending Auth
            </span>
            <div className="text-2xl font-bold text-[#242321] dark:text-[#F5F5F4]">
              {kpiStats.pending}
            </div>
            <p className="text-[11px] text-[#716D67]">Requires email or 1-click verify</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl">
            <Mail className="h-6 w-6" />
          </div>
        </div>

        {/* Academic Departments */}
        <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider">
              Departments & Cohorts
            </span>
            <div className="text-2xl font-bold text-[#242321] dark:text-[#F5F5F4]">
              {departments.length} Depts
            </div>
            <p className="text-[11px] text-[#716D67]">{cohorts.length} mapped cohorts</p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl">
            <Building2 className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* ═══════ 2. TOOLBAR: SEARCH, TABS & QUICK ENROLL ═══════ */}
      <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Segmented Status Tabs */}
          <div className="flex items-center gap-1 bg-[#F7F4EF] dark:bg-[#141312] p-1 rounded-xl border border-[#E5E0D8] dark:border-[#292524]">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === "all"
                  ? "bg-white dark:bg-[#1D1B19] text-[#242321] dark:text-[#F5F5F4] shadow-xs"
                  : "text-[#716D67] hover:text-[#242321]"
              }`}
            >
              All Students ({kpiStats.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("authorized")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === "authorized"
                  ? "bg-white dark:bg-[#1D1B19] text-emerald-700 dark:text-emerald-400 shadow-xs"
                  : "text-[#716D67] hover:text-[#242321]"
              }`}
            >
              Authorized ({kpiStats.authorized})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === "pending"
                  ? "bg-white dark:bg-[#1D1B19] text-amber-700 dark:text-amber-400 shadow-xs"
                  : "text-[#716D67] hover:text-[#242321]"
              }`}
            >
              Pending Auth ({kpiStats.pending})
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowStructureModal(true)}
              className="px-3 py-2 rounded-xl border border-[#E5E0D8] dark:border-[#292524] bg-white dark:bg-[#171615] text-xs font-semibold text-[#716D67] hover:text-[#242321] dark:hover:text-white flex items-center gap-1.5 transition-all shadow-xs"
              title="Manage Academic Departments, Degrees & Class Cohorts"
            >
              <Building2 className="h-3.5 w-3.5 text-[#C84B18]" />
              <span>Departments & Classes</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                showAdvancedFilters || selectedDeptId || selectedCohortId
                  ? "bg-[#C84B18]/10 border-[#C84B18]/30 text-[#C84B18]"
                  : "border-[#E5E0D8] dark:border-[#292524] bg-white dark:bg-[#171615] text-[#716D67] hover:text-[#242321]"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filters</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvancedFilters ? "rotate-180" : ""}`} />
            </button>

            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="px-3 py-2 rounded-xl border border-[#E5E0D8] dark:border-[#292524] bg-white dark:bg-[#171615] text-xs font-semibold text-[#716D67] hover:text-[#242321] dark:hover:text-white flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Upload className="h-3.5 w-3.5 text-[#C84B18]" />
              <span>Import Roster (CSV)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Enroll Student</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#716D67]" />
          <input
            type="text"
            placeholder="Search candidate by name, email, or roll number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:ring-1 focus:ring-[#C84B18]"
          />
        </div>

        {/* Collapsible Hierarchy Filters */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-[#E5E0D8] dark:border-[#292524] grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fadeIn">
            {/* Department */}
            <div>
              <label className="block text-[11px] font-semibold text-[#716D67] dark:text-[#A8A29E] mb-1">
                Department
              </label>
              <select
                value={selectedDeptId || ""}
                onChange={(e) => {
                  setSelectedDeptId(e.target.value || null);
                  setPage(1);
                }}
                className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg px-2.5 py-1.5 text-xs text-[#242321] dark:text-[#F5F5F4]"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Academic Session */}
            <div>
              <label className="block text-[11px] font-semibold text-[#716D67] dark:text-[#A8A29E] mb-1">
                Academic Session
              </label>
              <select
                value={selectedSessionId || ""}
                onChange={(e) => setSelectedSessionId(e.target.value || null)}
                className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg px-2.5 py-1.5 text-xs text-[#242321] dark:text-[#F5F5F4]"
              >
                <option value="">All Sessions</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Cohort */}
            <div>
              <label className="block text-[11px] font-semibold text-[#716D67] dark:text-[#A8A29E] mb-1">
                Academic Cohort
              </label>
              <select
                value={selectedCohortId || ""}
                onChange={(e) => {
                  setSelectedCohortId(e.target.value || null);
                  setPage(1);
                }}
                className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-lg px-2.5 py-1.5 text-xs text-[#242321] dark:text-[#F5F5F4]"
              >
                <option value="">All Cohorts</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.student_count || 0} students)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ 3. FLOATING BULK ACTION BAR ═══════ */}
      {selectedStudentIds.length > 0 && (
        <div className="bg-[#242321] text-white rounded-2xl p-4 shadow-xl flex items-center justify-between gap-4 animate-slideUp">
          <div className="flex items-center gap-3">
            <span className="bg-[#C84B18] text-white px-2.5 py-0.5 rounded-full text-xs font-bold">
              {selectedStudentIds.length} Selected
            </span>
            <span className="text-xs text-stone-300 hidden sm:inline">
              Choose a bulk operation to apply across all selected candidates:
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isBulkProcessing}
              onClick={handleBulkAuthorize}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Bulk Authorize</span>
            </button>

            <button
              type="button"
              disabled={isBulkProcessing}
              onClick={handleBulkDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Selected</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStudentIds([])}
              className="px-2.5 py-1.5 rounded-lg bg-stone-800 text-stone-300 hover:text-white text-xs"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* ═══════ 4. STUDENT DIRECTORY TABLE ═══════ */}
      <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E5E0D8] dark:border-[#292524] text-[#716D67] dark:text-[#A8A29E] bg-[#F7F4EF]/50 dark:bg-[#141312]">
                <th className="py-3.5 px-4 w-10">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="text-[#716D67] hover:text-[#242321]"
                  >
                    {selectedStudentIds.length === displayedStudents.length && displayedStudents.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-[#C84B18]" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Candidate</th>
                <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Roll Number</th>
                <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Department</th>
                <th className="py-3.5 px-4 font-semibold whitespace-nowrap min-w-[90px]">Division</th>
                <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Authorization</th>
                <th className="py-3.5 px-4 font-semibold whitespace-nowrap text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0D8] dark:divide-[#292524]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#716D67]">
                    <RefreshCw className="h-6 w-6 animate-spin text-[#C84B18] mx-auto mb-2" />
                    <span>Loading candidate directory...</span>
                  </td>
                </tr>
              ) : displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#716D67]">
                    {search ? "No students match your search term." : "No student records found."}
                  </td>
                </tr>
              ) : (
                displayedStudents.map((s) => {
                  const isSelected = selectedStudentIds.includes(s.id);

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-[#F0ECE4]/40 dark:hover:bg-[#1D1B19]/50 transition-colors ${
                        isSelected ? "bg-[#C84B18]/5 dark:bg-[#C84B18]/10" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectOne(s.id)}
                          className="text-[#716D67] hover:text-[#242321]"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-[#C84B18]" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>

                      {/* Candidate Name & Email */}
                      <td className="py-3 px-4">
                        <div
                          onClick={() => setInspectingStudentId(s.id)}
                          className="font-bold text-[#242321] dark:text-[#F5F5F4] hover:text-[#C84B18] cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <span>{s.full_name}</span>
                          <Eye className="h-3 w-3 text-[#716D67] opacity-60" />
                        </div>
                        <div className="text-[11px] text-[#716D67] font-mono">{s.email}</div>
                      </td>

                      {/* Roll Number */}
                      <td className="py-3 px-4 font-mono font-bold text-[#242321] dark:text-[#F5F5F4] whitespace-nowrap">
                        {s.roll_number}
                      </td>

                      {/* Department */}
                      <td className="py-3 px-4 text-[#716D67] whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900 text-[11px] font-medium">
                          {s.department_name || "General"}
                        </span>
                      </td>

                      {/* Division */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F7F4EF] dark:bg-[#1D1B19] border border-[#E5E0D8] dark:border-[#292524] text-[#242321] dark:text-[#F5F5F4] font-mono text-xs font-bold whitespace-nowrap shadow-2xs">
                          {s.division ? `Div ${s.division}` : "—"}
                        </span>
                      </td>

                      {/* Authorization Status Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {s.is_verified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                            <CheckCircle2 className="h-3 w-3" /> Authorized
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap">
                            <AlertCircle className="h-3 w-3" /> Pending Auth
                          </span>
                        )}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3 px-4 text-right">
                        {deletingId === s.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(s.id)}
                              className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(null)}
                              className="px-1.5 py-1 text-[10px] text-[#716D67]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Inspect Overview Drawer */}
                            <button
                              type="button"
                              onClick={() => setInspectingStudentId(s.id)}
                              className="p-1.5 rounded border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#C84B18] hover:bg-white dark:hover:bg-[#292524] transition-all"
                              title="View Student Assessment History & Overview"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>

                            {/* Edit Student */}
                            <button
                              type="button"
                              onClick={() => setEditingStudent(s)}
                              className="p-1.5 rounded border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#C84B18] hover:bg-white dark:hover:bg-[#292524] transition-all"
                              title="Edit Student Specifications"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>

                            {/* Instant Authorize (if pending) */}
                            {!s.is_verified && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleInstantAuthorize(s.id, s.full_name)}
                                  className="p-1.5 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all flex items-center gap-1 text-[10px] font-semibold"
                                  title="Instant 1-Click Authorize (Bypass Email)"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <span className="hidden lg:inline">Authorize Now</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleResendAuth(s.id, s.email)}
                                  className="p-1.5 rounded border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#C84B18] hover:bg-white dark:hover:bg-[#292524] transition-all"
                                  title="Resend Authorization Email"
                                >
                                  <Mail className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleCopyAuthLink(s.verification_url)}
                                  className="p-1.5 rounded border border-[#E5E0D8] dark:border-[#292524] text-[#716D67] hover:text-[#C84B18] hover:bg-white dark:hover:bg-[#292524] transition-all"
                                  title="Copy Authorization URL"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}

                            {/* Delete Student */}
                            <button
                              type="button"
                              onClick={() => setDeletingId(s.id)}
                              className="p-1.5 rounded text-[#716D67] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                              title="Delete Student Profile"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════ ENROLL STUDENT MODAL ═══════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#C84B18]/10 text-[#C84B18] rounded-xl">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">
                    Enroll Student Candidate
                  </h3>
                  <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                    Create student record and dispatch authorization email.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-[#716D67] hover:bg-[#E5E0D8]/40 dark:hover:bg-[#292524]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddStudentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] mb-1">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] mb-1">
                    Student Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@university.edu"
                    className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] mb-1">
                    Roll Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="CS-2026-101"
                    className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl px-3 py-2 text-xs font-mono text-[#242321] dark:text-[#F5F5F4]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] mb-1">
                    Department
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4]"
                  >
                    <option value="">General / None</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] mb-1">
                    Division
                  </label>
                  <input
                    type="text"
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    placeholder="A"
                    className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E5E0D8] dark:border-[#292524]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-xs font-semibold text-[#716D67]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary py-2 px-5 text-xs font-bold flex items-center gap-1.5"
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  <span>Enroll Candidate</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════ EDIT STUDENT MODAL ═══════ */}
      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          departments={departments}
          onClose={() => setEditingStudent(null)}
          onSuccess={fetchStudentsList}
        />
      )}

      {/* ═══════ CSV IMPORT MODAL ═══════ */}
      {showImportModal && (
        <CSVImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={fetchStudentsList}
        />
      )}

      {/* ═══════ STUDENT OVERVIEW DRAWER ═══════ */}
      {inspectingStudentId && (
        <StudentOverviewDrawer
          studentId={inspectingStudentId}
          onClose={() => setInspectingStudentId(null)}
          onRefreshDirectory={fetchStudentsList}
        />
      )}

      {/* ═══════ MANAGE ACADEMIC STRUCTURE MODAL ═══════ */}
      {showStructureModal && (
        <ManageAcademicStructureModal
          onClose={() => setShowStructureModal(false)}
          onRefreshStructure={() => {
            loadDepartments();
            loadSessions();
            loadCohortList();
            fetchStudentsList();
          }}
          onFilterToClass={(deptId, cohortId) => {
            setSelectedDeptId(deptId);
            setSelectedCohortId(cohortId);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}

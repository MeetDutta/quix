'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  FolderPlus,
  UploadCloud,
  DownloadCloud,
  Search,
  Trash2,
  Plus,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Mail,
  Phone,
  Hash,
  FileText,
  X
} from 'lucide-react';
import {
  fetchStudentDirectories,
  fetchDirectoryStudents,
  createStudentDirectory,
  deleteStudentDirectory,
  addStudentToDirectory,
  removeStudentFromDirectory,
  importStudentsCSV
} from '@/lib/api/studentDirectories';
import {
  StudentDirectory,
  DirectoryStudent,
  CSVImportResult
} from '@/types/studentDirectory';
import { API_V1 } from '@/lib/api';
import CreateDirectoryModal from './CreateDirectoryModal';

export default function StudentDirectoryManager() {
  const [directories, setDirectories] = useState<StudentDirectory[]>([]);
  const [selectedDirectory, setSelectedDirectory] = useState<StudentDirectory | null>(null);
  const [students, setStudents] = useState<DirectoryStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // Add Student Form State
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentRoll, setNewStudentRoll] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [studentActionLoading, setStudentActionLoading] = useState(false);
  const [studentActionError, setStudentActionError] = useState<string | null>(null);

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImportResult, setCsvImportResult] = useState<CSVImportResult | null>(null);
  const [csvImportLoading, setCsvImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  const loadDirectories = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchStudentDirectories(token);
      setDirectories(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load student directories');
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async (dirId: string) => {
    try {
      setStudentsLoading(true);
      const data = await fetchDirectoryStudents(dirId, token);
      setStudents(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load students for this directory');
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    loadDirectories();
  }, []);

  const handleSelectDirectory = (dir: StudentDirectory) => {
    setSelectedDirectory(dir);
    loadStudents(dir.id);
  };

  const handleDeleteDirectory = async (dirId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this student directory?')) return;
    try {
      await deleteStudentDirectory(dirId, token);
      setDirectories((prev) => prev.filter((d) => d.id !== dirId));
      if (selectedDirectory?.id === dirId) {
        setSelectedDirectory(null);
        setStudents([]);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete directory');
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDirectory) return;
    setStudentActionLoading(true);
    setStudentActionError(null);

    try {
      const created = await addStudentToDirectory(
        selectedDirectory.id,
        {
          name: newStudentName.trim(),
          email: newStudentEmail.trim().toLowerCase(),
          roll_number: newStudentRoll.trim() || undefined,
          phone: newStudentPhone.trim() || undefined
        },
        token
      );
      setStudents((prev) => [created, ...prev]);
      // Increment directory student count
      setSelectedDirectory((prev) =>
        prev ? { ...prev, student_count: prev.student_count + 1 } : null
      );
      setDirectories((prev) =>
        prev.map((d) =>
          d.id === selectedDirectory.id ? { ...d, student_count: d.student_count + 1 } : d
        )
      );
      setNewStudentName('');
      setNewStudentEmail('');
      setNewStudentRoll('');
      setNewStudentPhone('');
      setIsAddStudentModalOpen(false);
    } catch (err: any) {
      setStudentActionError(err.message || 'Failed to add student');
    } finally {
      setStudentActionLoading(false);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!selectedDirectory) return;
    if (!window.confirm('Remove this student from the directory?')) return;

    try {
      await removeStudentFromDirectory(selectedDirectory.id, studentId, token);
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      setSelectedDirectory((prev) =>
        prev ? { ...prev, student_count: Math.max(0, prev.student_count - 1) } : null
      );
      setDirectories((prev) =>
        prev.map((d) =>
          d.id === selectedDirectory.id
            ? { ...d, student_count: Math.max(0, d.student_count - 1) }
            : d
        )
      );
    } catch (err: any) {
      alert(err.message || 'Failed to remove student');
    }
  };

  const handleImportCsv = async () => {
    if (!selectedDirectory || !csvFile) return;
    setCsvImportLoading(true);
    setCsvImportResult(null);

    try {
      const result = await importStudentsCSV(selectedDirectory.id, csvFile, token);
      setCsvImportResult(result);
      // Reload students
      await loadStudents(selectedDirectory.id);
      // Update counts
      setSelectedDirectory((prev) =>
        prev ? { ...prev, student_count: prev.student_count + result.imported_count } : null
      );
      setDirectories((prev) =>
        prev.map((d) =>
          d.id === selectedDirectory.id
            ? { ...d, student_count: d.student_count + result.imported_count }
            : d
        )
      );
    } catch (err: any) {
      alert(err.message || 'Failed to upload student roster');
    } finally {
      setCsvImportLoading(false);
    }
  };

    const handleExportCsv = () => {
    if (!selectedDirectory) return;
    const downloadUrl = `${API_V1}/student-directories/${selectedDirectory.id}/export-csv?token=${encodeURIComponent(
      token
    )}`;
    window.open(downloadUrl, '_blank');
  };

  const handleExportExcel = () => {
    if (!selectedDirectory) return;
    const downloadUrl = `${API_V1}/student-directories/${selectedDirectory.id}/export-excel?token=${encodeURIComponent(
      token
    )}`;
    window.open(downloadUrl, '_blank');
  };

  const filteredDirectories = directories.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.roll_number && s.roll_number.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FFFFFF] dark:bg-[#171615] p-4 sm:p-6 rounded-2xl border border-[#E5E0D8] dark:border-[#292524] shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] border border-[#C84B18]/20">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-[#242321] dark:text-[#F5F5F4] tracking-tight">Student Directories</h2>
          </div>
          <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
            Create independent student directories for courses, batches, and candidate cohorts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#C84B18] hover:bg-[#B33F12] text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>New Student Directory</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main View: Directory Roster Detail OR Directories Grid */}
      {selectedDirectory ? (
        /* DETAIL ROSTER VIEW */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Breadcrumb / Back Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 bg-[#FFFFFF] dark:bg-[#171615] rounded-2xl border border-[#E5E0D8] dark:border-[#292524] shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedDirectory(null);
                  setSearchQuery('');
                }}
                className="p-2 rounded-xl bg-[#F0ECE4] dark:bg-[#292524] text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold text-[#242321] dark:text-[#F5F5F4]">{selectedDirectory.name}</h3>
                  <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] border border-[#C84B18]/20 rounded-full">
                    {students.length} Students
                  </span>
                </div>
                {selectedDirectory.description && (
                  <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-0.5">{selectedDirectory.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <button
                onClick={() => {
                  setCsvFile(null);
                  setCsvImportResult(null);
                  setIsCsvModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#F0ECE4] dark:bg-[#292524] text-[#242321] dark:text-[#F5F5F4] hover:bg-[#E5E0D8] dark:hover:bg-[#3E3A36] text-xs font-medium rounded-xl border border-[#E5E0D8] dark:border-[#3E3A36] transition-colors cursor-pointer shadow-2xs"
                title="Upload student roster from Excel (.xlsx, .xls) or CSV (.csv, .tsv)"
              >
                <UploadCloud className="w-3.5 h-3.5 text-[#C84B18]" />
                <span>Upload Excel</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#F0ECE4] dark:bg-[#292524] text-[#242321] dark:text-[#F5F5F4] hover:bg-[#E5E0D8] dark:hover:bg-[#3E3A36] text-xs font-medium rounded-xl border border-[#E5E0D8] dark:border-[#3E3A36] transition-colors cursor-pointer shadow-2xs"
                title="Export roster as Microsoft Excel (.xlsx)"
              >
                <DownloadCloud className="w-3.5 h-3.5 text-emerald-600" />
                <span>Excel</span>
              </button>

              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#F0ECE4] dark:bg-[#292524] text-[#242321] dark:text-[#F5F5F4] hover:bg-[#E5E0D8] dark:hover:bg-[#3E3A36] text-xs font-medium rounded-xl border border-[#E5E0D8] dark:border-[#3E3A36] transition-colors cursor-pointer shadow-2xs"
                title="Export roster as CSV (.csv)"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>

              <button
                onClick={() => setIsAddStudentModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#C84B18] hover:bg-[#B33F12] text-white text-xs font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Student</span>
              </button>
            </div>
          </div>

          {/* Search bar inside directory */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#716D67] dark:text-[#A8A29E] w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search students by name, email, or roll number..."
              className="w-full pl-11 pr-4 py-2.5 bg-[#FFFFFF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs text-[#242321] dark:text-[#F5F5F4] placeholder-[#716D67] dark:placeholder-[#A8A29E] focus:outline-none focus:ring-1 focus:ring-[#C84B18] transition-all"
            />
          </div>

          {/* Students Table */}
          <div className="bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl overflow-hidden shadow-sm">
            {studentsLoading ? (
              <div className="py-16 text-center text-[#716D67] dark:text-[#A8A29E] flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-[#C84B18] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs">Loading candidate roster...</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-[#F0ECE4] dark:bg-[#292524] text-[#716D67] dark:text-[#A8A29E] flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-[#242321] dark:text-[#F5F5F4]">No students in this directory yet</p>
                <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-1 max-w-sm mx-auto">
                  Add students manually or upload an Excel class roster file to target them in assessments.
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    onClick={() => setIsCsvModalOpen(true)}
                    className="px-4 py-2 text-xs font-semibold bg-[#C84B18] hover:bg-[#B33F12] text-white rounded-xl cursor-pointer shadow-sm"
                  >
                    Upload Excel
                  </button>
                  <button
                    onClick={() => setIsAddStudentModalOpen(true)}
                    className="px-4 py-2 text-xs font-medium bg-[#F0ECE4] dark:bg-[#292524] text-[#242321] dark:text-[#F5F5F4] hover:bg-[#E5E0D8] dark:hover:bg-[#3E3A36] rounded-xl cursor-pointer"
                  >
                    Add Single Student
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#242321] dark:text-[#F5F5F4]">
                  <thead className="bg-[#F7F4EF] dark:bg-[#1C1A17] text-[#716D67] dark:text-[#A8A29E] uppercase tracking-wider font-semibold border-b border-[#E5E0D8] dark:border-[#292524] text-[10px]">
                    <tr>
                      <th className="px-3.5 sm:px-6 py-3 sm:py-3.5 whitespace-nowrap">Student Name</th>
                      <th className="px-3.5 sm:px-6 py-3 sm:py-3.5 whitespace-nowrap">Email Address</th>
                      <th className="px-3.5 sm:px-6 py-3 sm:py-3.5 whitespace-nowrap">Roll / ID</th>
                      <th className="px-3.5 sm:px-6 py-3 sm:py-3.5 whitespace-nowrap">Phone Number</th>
                      <th className="px-3.5 sm:px-6 py-3 sm:py-3.5 whitespace-nowrap">Status</th>
                      <th className="px-3.5 sm:px-6 py-3 sm:py-3.5 whitespace-nowrap text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E0D8] dark:divide-[#292524]">
                    {filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-[#FAF8F5] dark:hover:bg-[#1C1A17] transition-colors">
                        <td className="px-3.5 sm:px-6 py-3 sm:py-3.5 whitespace-nowrap font-medium text-[#242321] dark:text-[#F5F5F4] flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] border border-[#C84B18]/20 flex items-center justify-center text-xs font-bold shrink-0">
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate">{s.name}</span>
                        </td>
                        <td className="px-3.5 sm:px-6 py-3 sm:py-3.5 whitespace-nowrap text-[#716D67] dark:text-[#A8A29E]">{s.email}</td>
                        <td className="px-3.5 sm:px-6 py-3 sm:py-3.5 whitespace-nowrap text-[#716D67] dark:text-[#A8A29E]">{s.roll_number || '—'}</td>
                        <td className="px-3.5 sm:px-6 py-3 sm:py-3.5 whitespace-nowrap text-[#716D67] dark:text-[#A8A29E]">{s.phone || '—'}</td>
                        <td className="px-3.5 sm:px-6 py-3 sm:py-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        </td>
                        <td className="px-3.5 sm:px-6 py-3 sm:py-3.5 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleRemoveStudent(s.id)}
                            className="p-1.5 text-[#716D67] dark:text-[#A8A29E] hover:text-red-500 rounded-lg hover:bg-[#F0ECE4] dark:hover:bg-[#292524] transition-colors cursor-pointer"
                            title="Remove student"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* DIRECTORIES GRID VIEW */
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#716D67] dark:text-[#A8A29E] w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search directories by name or description..."
              className="w-full pl-11 pr-4 py-2.5 bg-[#FFFFFF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs text-[#242321] dark:text-[#F5F5F4] placeholder-[#716D67] dark:placeholder-[#A8A29E] focus:outline-none focus:ring-1 focus:ring-[#C84B18] transition-all"
            />
          </div>

          {loading ? (
            <div className="py-20 text-center text-[#716D67] dark:text-[#A8A29E] flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#C84B18] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Loading student directories...</p>
            </div>
          ) : filteredDirectories.length === 0 ? (
            <div className="py-20 text-center bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl p-8 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] border border-[#C84B18]/20 flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">No Student Directories Found</h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-1 max-w-md mx-auto">
                Directories organize your students into distinct classes or cohorts so you can target them seamlessly when publishing exams.
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-[#C84B18] hover:bg-[#B33F12] text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Create Your First Directory</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredDirectories.map((dir) => (
                <div
                  key={dir.id}
                  onClick={() => handleSelectDirectory(dir)}
                  className="group relative bg-[#FFFFFF] dark:bg-[#171615] hover:bg-[#FAF8F5] dark:hover:bg-[#1C1A17] border border-[#E5E0D8] dark:border-[#292524] hover:border-[#C84B18]/50 dark:hover:border-[#EA580C]/50 rounded-2xl p-5 transition-all shadow-sm cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="p-3 rounded-xl bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] border border-[#C84B18]/20 group-hover:bg-[#C84B18]/20 transition-colors">
                        <Users className="w-5 h-5" />
                      </div>
                      <span className="px-2.5 py-1 text-[11px] font-semibold bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] border border-[#C84B18]/20 rounded-full">
                        {dir.student_count} Candidates
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4] group-hover:text-[#C84B18] transition-colors">
                      {dir.name}
                    </h4>
                    <p className="text-xs text-[#716D67] dark:text-[#A8A29E] mt-1 line-clamp-2">
                      {dir.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-[#E5E0D8] dark:border-[#292524] flex items-center justify-between text-xs text-[#716D67] dark:text-[#A8A29E]">
                    <span className="text-[11px]">
                      Created {new Date(dir.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => handleDeleteDirectory(dir.id, e)}
                      className="p-1.5 text-[#716D67] dark:text-[#A8A29E] hover:text-red-500 rounded-lg hover:bg-[#F0ECE4] dark:hover:bg-[#292524] transition-colors cursor-pointer"
                      title="Delete Directory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE DIRECTORY MODAL */}
      <CreateDirectoryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(newDir) => {
          setDirectories((prev) => [newDir, ...prev]);
          handleSelectDirectory(newDir);
        }}
      />

      {/* ADD STUDENT MODAL */}
      {isAddStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md mx-3 sm:mx-auto bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-[#E5E0D8] dark:border-[#292524] bg-[#FAF8F5] dark:bg-[#141312] shrink-0">
              <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">Add Student to Directory</h3>
              <button
                onClick={() => setIsAddStudentModalOpen(false)}
                className="p-1.5 text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="p-6 space-y-4">
              {studentActionError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{studentActionError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                  Full Name <span className="text-[#C84B18]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="e.g. Maya Lin"
                  className="w-full px-3.5 py-2 bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs text-[#242321] dark:text-[#F5F5F4] placeholder-[#716D67] dark:placeholder-[#A8A29E] focus:outline-none focus:ring-1 focus:ring-[#C84B18]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                  Email Address <span className="text-[#C84B18]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  placeholder="e.g. maya.lin@university.edu"
                  className="w-full px-3.5 py-2 bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs text-[#242321] dark:text-[#F5F5F4] placeholder-[#716D67] dark:placeholder-[#A8A29E] focus:outline-none focus:ring-1 focus:ring-[#C84B18]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                    Roll / ID
                  </label>
                  <input
                    type="text"
                    value={newStudentRoll}
                    onChange={(e) => setNewStudentRoll(e.target.value)}
                    placeholder="e.g. CS-2026-08"
                    className="w-full px-3.5 py-2 bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs text-[#242321] dark:text-[#F5F5F4] placeholder-[#716D67] dark:placeholder-[#A8A29E] focus:outline-none focus:ring-1 focus:ring-[#C84B18]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={newStudentPhone}
                    onChange={(e) => setNewStudentPhone(e.target.value)}
                    placeholder="e.g. +1 555-0199"
                    className="w-full px-3.5 py-2 bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs text-[#242321] dark:text-[#F5F5F4] placeholder-[#716D67] dark:placeholder-[#A8A29E] focus:outline-none focus:ring-1 focus:ring-[#C84B18]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E0D8] dark:border-[#292524]">
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={studentActionLoading}
                  className="px-4 py-2 text-xs font-semibold bg-[#C84B18] hover:bg-[#B33F12] text-white rounded-xl shadow-sm transition-colors cursor-pointer"
                >
                  {studentActionLoading ? 'Adding...' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV & EXCEL IMPORT MODAL */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg mx-3 sm:mx-auto bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-[#E5E0D8] dark:border-[#292524] bg-[#FAF8F5] dark:bg-[#141312] shrink-0">
              <div className="flex items-center gap-2.5">
                <UploadCloud className="w-5 h-5 text-[#C84B18]" />
                <div>
                  <h3 className="text-base font-bold text-[#242321] dark:text-[#F5F5F4]">Upload Student Roster (Excel / CSV)</h3>
                  <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">Universal spreadsheet support with auto header mapping</p>
                </div>
              </div>
              <button
                onClick={() => setIsCsvModalOpen(false)}
                className="p-1.5 text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              {/* Downloadable Reference File Box */}
              <div className="p-3.5 bg-[#FAF8F5] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#242321] dark:text-[#F5F5F4] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#C84B18]" />
                    <span>Download Reference Template</span>
                  </span>
                  <span className="text-[10px] text-[#716D67] uppercase font-semibold">Sample Files</span>
                </div>
                <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">
                  Use our sample template pre-configured with the required columns (Full Name, Email, Roll/Student ID, Phone, Division).
                </p>
                <div className="flex flex-col xs:flex-row items-center gap-2 pt-1">
                  <a
                    href={`${API_V1}/student-directories/template/excel`}
                    download="student_roster_template.xlsx"
                    className="w-full xs:flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <DownloadCloud className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Excel Template (.xlsx)</span>
                  </a>
                  <a
                    href={`${API_V1}/student-directories/template/csv`}
                    download="student_roster_template.csv"
                    className="w-full xs:flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#C84B18]/10 hover:bg-[#C84B18]/20 text-[#C84B18] dark:text-[#EA580C] border border-[#C84B18]/30 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    <span>CSV Template (.csv)</span>
                  </a>
                </div>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                accept=".csv, .xlsx, .xls, .tsv, .txt, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setCsvFile(e.target.files[0]);
                    setCsvImportResult(null);
                  }
                }}
                className="hidden"
              />

              {!csvFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#E5E0D8] dark:border-[#292524] hover:border-[#C84B18]/50 bg-[#F7F4EF] dark:bg-[#141312] hover:bg-[#F0ECE4] dark:hover:bg-[#1C1A17] rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
                >
                  <UploadCloud className="w-8 h-8 text-[#C84B18]" />
                  <p className="text-xs text-[#242321] dark:text-[#F5F5F4] font-medium">Click to select an Excel (.xlsx, .xls) or CSV roster file</p>
                  <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">
                    Supports .xlsx, .xls, .csv, and .tsv with automatic comma, semicolon, and tab detection
                  </p>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] bg-[#E5E0D8]/60 dark:bg-[#292524] text-[#716D67] dark:text-[#A8A29E] font-medium">
                    Headers: Full Name, Email, Roll Number, Phone, Division
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3.5 bg-[#C84B18]/10 border border-[#C84B18]/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-[#C84B18]" />
                    <div>
                      <p className="text-xs font-medium text-[#242321] dark:text-[#F5F5F4]">{csvFile.name}</p>
                      <p className="text-[10px] text-[#716D67] dark:text-[#A8A29E]">{(csvFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setCsvFile(null);
                      setCsvImportResult(null);
                    }}
                    className="p-1 text-[#716D67] hover:text-red-500 rounded cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {csvImportResult && (
                <div className="space-y-2 p-4 bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-xs">
                  <div className="flex items-center justify-between font-semibold text-[#242321] dark:text-[#F5F5F4]">
                    <span>Import Summary</span>
                    <span className="text-emerald-600 dark:text-emerald-400">+{csvImportResult.imported_count} Added</span>
                  </div>
                  <p className="text-[#716D67] dark:text-[#A8A29E] text-[11px]">
                    Processed {csvImportResult.total_rows} rows. Skipped {csvImportResult.skipped_count} invalid or duplicates.
                  </p>
                  {csvImportResult.errors.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto space-y-1 pr-1">
                      {csvImportResult.errors.map((err, i) => (
                        <div key={i} className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 p-1.5 rounded">
                          Row {err.row}: {err.reason} ({err.email || 'no email'})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E0D8] dark:border-[#292524]">
                <button
                  type="button"
                  onClick={() => setIsCsvModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-white cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={!csvFile || csvImportLoading}
                  onClick={handleImportCsv}
                  className="px-4 py-2 text-xs font-semibold bg-[#C84B18] hover:bg-[#B33F12] disabled:opacity-50 text-white rounded-xl shadow-sm transition-colors cursor-pointer"
                >
                  {csvImportLoading ? 'Uploading Roster...' : 'Upload Excel Roster'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

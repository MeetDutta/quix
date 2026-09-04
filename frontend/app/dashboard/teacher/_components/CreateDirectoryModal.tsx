'use client';

import React, { useState, useRef } from 'react';
import { X, FolderPlus, UploadCloud, FileText, CheckCircle, AlertCircle, Users, DownloadCloud } from 'lucide-react';
import { createStudentDirectory, importStudentsCSV } from '@/lib/api/studentDirectories';
import { StudentDirectory } from '@/types/studentDirectory';
import { API_V1 } from '@/lib/api';

interface CreateDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newDir: StudentDirectory) => void;
}

export default function CreateDirectoryModal({
  isOpen,
  onClose,
  onCreated
}: CreateDirectoryModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const validExts = ['.csv', '.xlsx', '.xls', '.tsv', '.txt'];
      const isValid = validExts.some((ext) => file.name.toLowerCase().endsWith(ext));
      if (isValid) {
        setCsvFile(file);
        setError(null);
      } else {
        setError('Please drop a valid Excel (.xlsx, .xls) or CSV (.csv, .tsv) file');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name for this Student Directory.');
      return;
    }

    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token') || '';

    try {
      // 1. Create the directory
      const newDir = await createStudentDirectory(
        {
          name: name.trim(),
          description: description.trim() || undefined
        },
        token
      );

      // 2. If CSV file attached, upload and populate students
      if (csvFile) {
        try {
          const importResult = await importStudentsCSV(newDir.id, csvFile, token);
          newDir.student_count = importResult.imported_count;
        } catch (err: any) {
          console.error('CSV import warning:', err);
          // Directory is still created
        }
      }

      onCreated(newDir);
      setName('');
      setDescription('');
      setCsvFile(null);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create student directory');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg mx-3 sm:mx-auto overflow-hidden bg-[#FFFFFF] dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-5 border-b border-[#E5E0D8] dark:border-[#292524] bg-[#FAF8F5] dark:bg-[#141312] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] border border-[#C84B18]/20">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-[#242321] dark:text-[#F5F5F4]">Create Student Directory</h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">Add a cohort or class roster for assessments</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-white rounded-lg hover:bg-[#F0ECE4] dark:hover:bg-[#292524] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] mb-1.5">
              Directory Name <span className="text-[#C84B18]">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CS 301 - Algorithm Design (Fall 2026)"
              className="w-full px-4 py-2.5 bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-sm text-[#242321] dark:text-[#F5F5F4] placeholder-[#716D67] dark:placeholder-[#A8A29E] focus:outline-none focus:ring-1 focus:ring-[#C84B18] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] mb-1.5">
              Description <span className="text-[#716D67] dark:text-[#A8A29E] font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Section B morning laboratory batch"
              className="w-full px-4 py-2.5 bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl text-sm text-[#242321] dark:text-[#F5F5F4] placeholder-[#716D67] dark:placeholder-[#A8A29E] focus:outline-none focus:ring-1 focus:ring-[#C84B18] transition-all"
            />
          </div>

          {/* Optional CSV / Excel Upload Dropzone */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E]">
                Initial Student Roster <span className="text-[#716D67] dark:text-[#A8A29E] font-normal">(Optional Excel / CSV)</span>
              </label>
              <div className="flex items-center gap-1.5 text-[10px] text-[#716D67]">
                <span>Sample:</span>
                <a
                  href={`${API_V1}/student-directories/template/excel`}
                  download="student_roster_template.xlsx"
                  className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                >
                  Excel
                </a>
                <span>·</span>
                <a
                  href={`${API_V1}/student-directories/template/csv`}
                  download="student_roster_template.csv"
                  className="text-[#C84B18] font-semibold hover:underline"
                >
                  CSV
                </a>
              </div>
            </div>
            
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv, .xlsx, .xls, .tsv, .txt, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!csvFile ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#E5E0D8] dark:border-[#292524] hover:border-[#C84B18]/50 bg-[#F7F4EF] dark:bg-[#141312] hover:bg-[#F0ECE4] dark:hover:bg-[#1C1A17] rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
              >
                <div className="p-2.5 rounded-full bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C]">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div className="text-xs text-[#242321] dark:text-[#F5F5F4]">
                  <span className="text-[#C84B18] font-medium hover:underline">Click to upload Excel or CSV</span> or drag and drop
                </div>
                <p className="text-[11px] text-[#716D67] dark:text-[#A8A29E]">
                  Supports .xlsx, .xls, .csv, and .tsv with automatic column detection
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3.5 bg-[#C84B18]/10 border border-[#C84B18]/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-[#C84B18]" />
                  <div>
                    <p className="text-xs font-medium text-[#242321] dark:text-[#F5F5F4] truncate max-w-[240px]">{csvFile.name}</p>
                    <p className="text-[10px] text-[#716D67] dark:text-[#A8A29E]">{(csvFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCsvFile(null)}
                  className="p-1 text-[#716D67] hover:text-red-500 rounded transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E0D8] dark:border-[#292524]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#716D67] dark:text-[#A8A29E] hover:text-[#242321] dark:hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#C84B18] hover:bg-[#B33F12] rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Creating Directory...</span>
                </>
              ) : (
                <>
                  <FolderPlus className="w-4 h-4" />
                  <span>Create & Select Directory</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

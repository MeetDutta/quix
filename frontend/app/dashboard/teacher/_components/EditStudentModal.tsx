"use client";

import { useState, useEffect } from "react";
import { X, User, Mail, Hash, Building2, Layers, Check, Loader2 } from "lucide-react";
import { apiFetch } from "../../../../lib/api";
import { useAuthStore } from "../../../../store/authStore";
import { useToast } from "../../../../components/Toast";

interface EditStudentModalProps {
  student: any;
  departments: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditStudentModal({
  student,
  departments,
  onClose,
  onSuccess,
}: EditStudentModalProps) {
  const { token } = useAuthStore();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState(student.full_name || "");
  const [email, setEmail] = useState(student.email || "");
  const [rollNumber, setRollNumber] = useState(student.roll_number || "");
  const [division, setDivision] = useState(student.division || "A");
  const [batch, setBatch] = useState(student.batch || "2026");
  const [departmentId, setDepartmentId] = useState(student.department_id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !rollNumber.trim()) {
      showToast("Full name and roll number are required", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/students/${student.id}`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          roll_number: rollNumber.trim(),
          division: division.trim() || "A",
          batch: batch.trim() || "2026",
          department_id: departmentId || undefined,
        }),
      });

      if (res.ok) {
        showToast("Student profile updated successfully!", "success");
        onSuccess();
        onClose();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Failed to update student profile", "error");
      }
    } catch {
      showToast("Network error updating student", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#171615] border border-[#E5E0D8] dark:border-[#292524] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E0D8] dark:border-[#292524] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] rounded-xl border border-[#C84B18]/20">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#242321] dark:text-[#F5F5F4]">
                Edit Student Profile
              </h3>
              <p className="text-xs text-[#716D67] dark:text-[#A8A29E]">
                Modify candidate specifications and classroom placement.
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] mb-1">
              Full Legal Name *
            </label>
            <div className="relative">
              <User className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#716D67]" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Samantha Miller"
                className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl pl-9 pr-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:ring-1 focus:ring-[#C84B18]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] mb-1">
                Student Email Address
              </label>
              <div className="relative">
                <Mail className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#716D67]" />
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full bg-[#E5E0D8]/40 dark:bg-[#292524]/40 border border-[#E5E0D8] dark:border-[#292524] rounded-xl pl-9 pr-3 py-2 text-xs text-[#716D67] cursor-not-allowed"
                  title="Email cannot be edited directly for security"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] mb-1">
                Roll Number *
              </label>
              <div className="relative">
                <Hash className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#716D67]" />
                <input
                  type="text"
                  required
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="e.g. CS-2026-102"
                  className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:ring-1 focus:ring-[#C84B18]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] mb-1">
                Department
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:ring-1 focus:ring-[#C84B18]"
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
                placeholder="e.g. A"
                className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:ring-1 focus:ring-[#C84B18]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#716D67] dark:text-[#A8A29E] mb-1">
                Batch Year
              </label>
              <input
                type="text"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="e.g. 2026"
                className="w-full bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] rounded-xl px-3 py-2 text-xs text-[#242321] dark:text-[#F5F5F4] focus:outline-none focus:ring-1 focus:ring-[#C84B18]"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E5E0D8] dark:border-[#292524]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#E5E0D8] dark:border-[#292524] text-xs font-semibold text-[#716D67] hover:text-[#242321] dark:hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary py-2 px-5 text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

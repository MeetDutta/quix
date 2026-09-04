import { apiFetch } from '../api';
import {
  StudentDirectory,
  DirectoryStudent,
  StudentDirectoryCreate,
  DirectoryStudentCreate,
  CSVImportResult
} from '@/types/studentDirectory';

export async function fetchStudentDirectories(token?: string | null): Promise<StudentDirectory[]> {
  const res = await apiFetch('/student-directories/', { token });
  if (!res.ok) {
    throw new Error('Failed to fetch student directories');
  }
  return res.json();
}

export async function fetchStudentDirectory(id: string, token?: string | null): Promise<StudentDirectory> {
  const res = await apiFetch(`/student-directories/${id}`, { token });
  if (!res.ok) {
    throw new Error('Failed to fetch student directory');
  }
  return res.json();
}

export async function createStudentDirectory(
  payload: StudentDirectoryCreate,
  token?: string | null
): Promise<StudentDirectory> {
  const res = await apiFetch('/student-directories/', {
    method: 'POST',
    body: JSON.stringify(payload),
    token
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create student directory' }));
    throw new Error(err.detail || 'Failed to create student directory');
  }
  return res.json();
}

export async function updateStudentDirectory(
  id: string,
  payload: Partial<StudentDirectoryCreate>,
  token?: string | null
): Promise<StudentDirectory> {
  const res = await apiFetch(`/student-directories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    token
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to update student directory' }));
    throw new Error(err.detail || 'Failed to update student directory');
  }
  return res.json();
}

export async function deleteStudentDirectory(id: string, token?: string | null): Promise<void> {
  const res = await apiFetch(`/student-directories/${id}`, {
    method: 'DELETE',
    token
  });
  if (!res.ok) {
    throw new Error('Failed to delete student directory');
  }
}

export async function fetchDirectoryStudents(
  directoryId: string,
  token?: string | null
): Promise<DirectoryStudent[]> {
  const res = await apiFetch(`/student-directories/${directoryId}/students`, { token });
  if (!res.ok) {
    throw new Error('Failed to fetch directory students');
  }
  return res.json();
}

export async function addStudentToDirectory(
  directoryId: string,
  payload: DirectoryStudentCreate,
  token?: string | null
): Promise<DirectoryStudent> {
  const res = await apiFetch(`/student-directories/${directoryId}/students`, {
    method: 'POST',
    body: JSON.stringify(payload),
    token
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to add student' }));
    throw new Error(err.detail || 'Failed to add student');
  }
  return res.json();
}

export async function removeStudentFromDirectory(
  directoryId: string,
  studentId: string,
  token?: string | null
): Promise<void> {
  const res = await apiFetch(`/student-directories/${directoryId}/students/${studentId}`, {
    method: 'DELETE',
    token
  });
  if (!res.ok) {
    throw new Error('Failed to remove student');
  }
}

export async function importStudentsCSV(
  directoryId: string,
  file: File,
  token?: string | null
): Promise<CSVImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiFetch(`/student-directories/${directoryId}/import`, {
    method: 'POST',
    body: formData,
    token
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to import student roster' }));
    throw new Error(err.detail || 'Failed to import student roster');
  }
  return res.json();
}

export const importStudentsFile = importStudentsCSV;

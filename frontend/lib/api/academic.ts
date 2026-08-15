import { apiFetch } from "../api";
import { AcademicSession, Cohort, SubjectOffering } from "../../types/academic";

export async function fetchAcademicSessions(token: string | null): Promise<AcademicSession[]> {
  const res = await apiFetch("/academic/sessions", { token });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchCohorts(
  token: string | null,
  filters?: { course_id?: string; academic_session_id?: string; year_number?: number }
): Promise<Cohort[]> {
  const params = new URLSearchParams();
  if (filters?.course_id) params.append("course_id", filters.course_id);
  if (filters?.academic_session_id) params.append("academic_session_id", filters.academic_session_id);
  if (filters?.year_number) params.append("year_number", String(filters.year_number));

  const queryStr = params.toString() ? `?${params.toString()}` : "";
  const res = await apiFetch(`/academic/cohorts${queryStr}`, { token });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchCohortStudents(token: string | null, cohortId: string): Promise<any[]> {
  const res = await apiFetch(`/academic/cohorts/${cohortId}/students`, { token });
  if (!res.ok) return [];
  return res.json();
}

export async function createCohort(
  token: string | null,
  data: { course_id: string; academic_session_id: string; year_number: number; semester_number: number; division: string; name?: string }
): Promise<Cohort | null> {
  const res = await apiFetch("/academic/cohorts", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
  if (!res.ok) return null;
  return res.json();
}

import { apiFetch } from "../api";
import { AssessmentGroup } from "../../types/academic";

export async function fetchAssessmentGroups(token: string | null, groupType?: string): Promise<AssessmentGroup[]> {
  const queryStr = groupType ? `?group_type=${groupType}` : "";
  const res = await apiFetch(`/assessment-groups${queryStr}`, { token });
  if (!res.ok) return [];
  return res.json();
}

export async function createAssessmentGroup(
  token: string | null,
  data: { name: string; type: "COHORT" | "CUSTOM"; cohort_id?: string; student_ids?: string[] }
): Promise<AssessmentGroup | null> {
  const res = await apiFetch("/assessment-groups", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchGroupStudents(token: string | null, groupId: string): Promise<any[]> {
  const res = await apiFetch(`/assessment-groups/${groupId}/students`, { token });
  if (!res.ok) return [];
  return res.json();
}

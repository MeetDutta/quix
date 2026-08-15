export interface AcademicSession {
  id: string;
  institution_id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
}

export interface Cohort {
  id: string;
  name: string;
  course_id: string;
  academic_session_id: string;
  year_number: number;
  semester_number: number;
  division: string;
  is_active: boolean;
  student_count?: number;
}

export interface SubjectOffering {
  id: string;
  subject_id: string;
  cohort_id: string;
  teacher_id?: string;
  academic_session_id: string;
  status: string;
}

export interface AssessmentGroup {
  id: string;
  name: string;
  type: "COHORT" | "CUSTOM";
  cohort_id?: string;
  created_by?: string;
  student_count?: number;
  created_at?: string;
}

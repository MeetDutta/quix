export interface DirectoryStudent {
  id: string;
  directory_id: string;
  name: string;
  email: string;
  roll_number?: string | null;
  phone?: string | null;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface StudentDirectory {
  id: string;
  workspace_id: string;
  name: string;
  description?: string | null;
  created_by?: string | null;
  is_active: boolean;
  student_count: number;
  created_at: string;
  updated_at: string;
}

export interface DirectoryStudentCreate {
  name: string;
  email: string;
  roll_number?: string;
  phone?: string;
}

export interface StudentDirectoryCreate {
  name: string;
  description?: string;
  initial_students?: DirectoryStudentCreate[];
}

export interface CSVImportError {
  row: number;
  email?: string;
  reason: string;
}

export interface CSVImportResult {
  total_rows: number;
  imported_count: number;
  skipped_count: number;
  errors: CSVImportError[];
}

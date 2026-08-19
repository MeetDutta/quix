export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  is_personal: boolean;
  role?: string;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'OWNER' | 'ADMIN' | 'TEACHER' | 'VIEWER';
  user_email?: string;
  user_name?: string;
  created_at: string;
}

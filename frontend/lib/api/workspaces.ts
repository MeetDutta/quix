import { apiFetch } from '../api';
import { Workspace } from '@/types/workspace';

export async function fetchCurrentWorkspace(token: string): Promise<Workspace> {
  const res = await apiFetch('/workspaces/current', { token });
  if (!res.ok) {
    throw new Error('Failed to fetch current workspace');
  }
  return res.json();
}

export async function fetchUserWorkspaces(token: string): Promise<Workspace[]> {
  const res = await apiFetch('/workspaces/', { token });
  if (!res.ok) {
    throw new Error('Failed to fetch workspaces');
  }
  return res.json();
}

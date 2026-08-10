import { create } from 'zustand';

interface AuthState {
  token: string | null;
  role: string | null;
  fullName: string | null;
  institutionId: string | null;
  setAuth: (token: string, role: string, fullName: string, institutionId?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  role: typeof window !== 'undefined' ? localStorage.getItem('role') : null,
  fullName: typeof window !== 'undefined' ? localStorage.getItem('fullName') : null,
  institutionId: typeof window !== 'undefined' ? localStorage.getItem('institutionId') : null,
  
  setAuth: (token, role, fullName, institutionId) => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    localStorage.setItem('fullName', fullName);
    if (institutionId) {
      localStorage.setItem('institutionId', institutionId);
    }
    set({ token, role, fullName, institutionId: institutionId || null });
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('fullName');
    localStorage.removeItem('institutionId');
    set({ token: null, role: null, fullName: null, institutionId: null });
  }
}));

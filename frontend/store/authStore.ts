import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  role: string | null;
  fullName: string | null;
  institutionId: string | null;
  setAuth: (token: string, role: string, fullName: string, institutionId?: string) => void;
  logout: () => void;
  syncFromStorage: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
      role: typeof window !== 'undefined' ? localStorage.getItem('role') : null,
      fullName: typeof window !== 'undefined' ? localStorage.getItem('fullName') : null,
      institutionId: typeof window !== 'undefined' ? localStorage.getItem('institutionId') : null,
      
      setAuth: (token, role, fullName, institutionId) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', token);
          localStorage.setItem('role', role);
          localStorage.setItem('fullName', fullName);
          if (institutionId) {
            localStorage.setItem('institutionId', institutionId);
          }
        }
        set({ token, role, fullName, institutionId: institutionId || null });
      },
      
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          localStorage.removeItem('fullName');
          localStorage.removeItem('institutionId');
          localStorage.removeItem('workspaceId');
          localStorage.removeItem('workspaceName');
        }
        set({ token: null, role: null, fullName: null, institutionId: null });
      },

      syncFromStorage: () => {
        if (typeof window !== 'undefined') {
          const t = localStorage.getItem('token');
          const r = localStorage.getItem('role');
          const n = localStorage.getItem('fullName');
          const inst = localStorage.getItem('institutionId');
          if (t && get().token !== t) {
            set({ token: t, role: r, fullName: n, institutionId: inst });
          }
        }
      }
    }),
    {
      name: 'eduquizx-auth',
      onRehydrateStorage: () => (state) => {
        if (typeof window !== 'undefined' && state) {
          const legacyToken = localStorage.getItem('token');
          if (legacyToken && !state.token) {
            state.token = legacyToken;
            state.role = localStorage.getItem('role');
            state.fullName = localStorage.getItem('fullName');
            state.institutionId = localStorage.getItem('institutionId');
          }
        }
      }
    }
  )
);

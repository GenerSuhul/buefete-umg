import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { dataSource } from '../data/dataSource';
import type { AuthenticatedUser } from '../types/domain';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  updateProfile(input: { fullName: string; email: string }): Promise<void>;
  updatePhoto(file: File): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
}

const mockUser: AuthenticatedUser = {
  id: '40000000-0000-0000-0000-000000000001',
  username: 'admin.general',
  email: 'admin.bufete@umg.edu.gt',
  fullName: 'Lic. Mónica Estrada',
  photoDocumentId: null,
  roles: ['AdministradorGeneral'],
  permissions: ['*'],
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = sessionStorage.getItem('bufete_umg_session');
  const storedUser = stored ? (JSON.parse(stored) as { user?: AuthenticatedUser }).user ?? null : null;
  const [user, setUser] = useState<AuthenticatedUser | null>(dataSource.mode === 'mock' ? mockUser : storedUser);
  const [loading, setLoading] = useState(false);

  const applyUserSummary = (summary: { fullName: string; email: string; photoDocumentId: string | null }) => {
    setUser((current) => current ? { ...current, ...summary } : current);
    const raw = sessionStorage.getItem('bufete_umg_session');
    if (!raw) return;
    const session = JSON.parse(raw) as { user?: AuthenticatedUser };
    if (session.user) session.user = { ...session.user, ...summary };
    sessionStorage.setItem('bufete_umg_session', JSON.stringify(session));
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async login(email, password) {
      setLoading(true);
      try {
        const response = await dataSource.login(email, password);
        setUser(response.user);
      } finally {
        setLoading(false);
      }
    },
    async logout() {
      setLoading(true);
      try {
        await dataSource.logout();
        setUser(dataSource.mode === 'mock' ? mockUser : null);
      } finally {
        setLoading(false);
      }
    },
    async updateProfile(input) {
      setLoading(true);
      try { applyUserSummary(await dataSource.updateOwnProfile(input)); }
      finally { setLoading(false); }
    },
    async updatePhoto(file) {
      setLoading(true);
      try { applyUserSummary(await dataSource.setOwnPhoto(file)); }
      finally { setLoading(false); }
    },
    async changePassword(currentPassword, newPassword) {
      setLoading(true);
      try { await dataSource.changeOwnPassword(currentPassword, newPassword); }
      finally { setLoading(false); }
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  return context;
}

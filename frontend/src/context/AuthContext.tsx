import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNotify } from '../components/ui/Feedback';
import { readAuthSession, updateAuthSessionUser } from '../data/authSession';
import { dataSource } from '../data/dataSource';
import type { AuthenticatedUser } from '../types/domain';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  loading: boolean;
  login(email: string, password: string, tenantCode?: string): Promise<void>;
  logout(options?: { silent?: boolean }): Promise<void>;
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
  const notify = useNotify();
  const storedUser = readAuthSession()?.user ?? null;
  const [user, setUser] = useState<AuthenticatedUser | null>(dataSource.mode === 'mock' ? mockUser : storedUser);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dataSource.mode === 'mock' || !readAuthSession()) return;
    let active = true;
    dataSource.getCurrentUser().then((profile) => {
      if (!active || readAuthSession()?.user.id !== profile.id) return;
      const summary = { fullName: profile.fullName, email: profile.email, photoDocumentId: profile.photoDocumentId };
      setUser((current) => current?.id === profile.id ? { ...current, ...summary } : current);
      updateAuthSessionUser(summary);
    }).catch(() => { /* The request handler reports session expiry; retain the profile on transient failures. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const sessionExpired = () => {
      setUser(null);
      notify.warning({ title: 'Tu sesión finalizó', message: 'Vuelve a iniciar sesión para continuar.', duration: 8000 });
    };
    window.addEventListener('bufete:session-expired', sessionExpired);
    return () => window.removeEventListener('bufete:session-expired', sessionExpired);
  }, [notify]);

  const applyUserSummary = (summary: { fullName: string; email: string; photoDocumentId: string | null }) => {
    setUser((current) => current ? { ...current, ...summary } : current);
    updateAuthSessionUser(summary);
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async login(email, password, tenantCode) {
      setLoading(true);
      try {
        const response = await dataSource.login(email, password, tenantCode);
        setUser(response.user);
      } finally {
        setLoading(false);
      }
    },
    async logout(options) {
      setLoading(true);
      try {
        await dataSource.logout();
        setUser(null);
        if (!options?.silent) notify.info({ title: 'Sesión cerrada', message: 'Tu sesión finalizó de forma segura.' });
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
  }), [loading, notify, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  return context;
}

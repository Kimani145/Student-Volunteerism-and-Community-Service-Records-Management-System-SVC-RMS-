'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole, type AuthUser } from '@svc-rms/shared';
import { apiFetch, getAccessToken, setAccessToken } from '@/lib/api-client';

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial load
    const loadUser = async () => {
      try {
        const res = await apiFetch<AuthUser>('/auth/me');
        setUser(res);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const { accessToken } = await apiFetch<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setAccessToken(accessToken);
    const me = await apiFetch<AuthUser>('/auth/me');
    setUser(me);
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken('');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function RoleGate({ roles, children }: { roles: (UserRole | `${UserRole}` | string)[], children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user || !roles.includes(user.role)) return <div>Access Denied</div>;
  return <>{children}</>;
}

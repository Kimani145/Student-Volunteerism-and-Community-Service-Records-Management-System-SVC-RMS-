'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch, getAccessToken, setAccessToken } from '../api-client.js';

interface AuthContextType {
  user: any;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial load
    const loadUser = async () => {
      try {
        const res = await apiFetch<any>('/auth/me');
        setUser(res);
      } catch (err) {
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
    const me = await apiFetch<any>('/auth/me');
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

export function RoleGate({ roles, children }: { roles: string[], children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user || !roles.includes(user.role)) return <div>Access Denied</div>;
  return <>{children}</>;
}

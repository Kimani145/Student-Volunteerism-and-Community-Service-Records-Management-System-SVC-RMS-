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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && !user && mounted) {
      const currentPath = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${currentPath}`;
    }
  }, [user, loading, mounted]);

  if (loading || !mounted) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 min-h-[50vh]">
        <svg className="animate-spin h-8 w-8 text-indigo-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-sm font-medium">Verifying access...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  if (!roles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-rose-50 border border-rose-100 rounded-xl min-h-[50vh] m-4 sm:m-8 max-w-2xl mx-auto">
        <div className="w-16 h-16 bg-white text-rose-500 rounded-full flex items-center justify-center mb-4 text-3xl shadow-sm border border-rose-100">
          !
        </div>
        <h3 className="text-lg font-bold text-rose-900 mb-1">Access Denied</h3>
        <p className="text-sm text-rose-700 mb-2 text-center">
          You are currently signed in as a {user.role}, but this page requires one of the following roles: {roles.join(', ')}.
        </p>
        <button onClick={() => window.history.back()} className="mt-4 px-5 py-2.5 bg-white text-rose-700 border border-rose-200 text-sm font-bold rounded-lg hover:bg-rose-50 transition shadow-sm">
          Go Back
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

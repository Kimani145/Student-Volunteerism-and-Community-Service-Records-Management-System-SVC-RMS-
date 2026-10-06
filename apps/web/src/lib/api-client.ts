import { ErrorCode } from '@svc-rms/shared';

let _accessToken = '';
export const getAccessToken = () => _accessToken;
export const setAccessToken = (token: string) => { _accessToken = token; };

let refreshPromise: Promise<void> | null = null;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode | string,
    public readonly detail: string,
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  let response = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  
  if (response.status === 401 && path !== '/auth/refresh' && path !== '/auth/login') {
    if (!refreshPromise) {
      refreshPromise = fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
        .then(async (res) => {
          if (!res.ok) throw new Error('Refresh failed');
          const data = await res.json();
          setAccessToken(data.accessToken);
        })
        .finally(() => { refreshPromise = null; });
    }
    
    try {
      await refreshPromise;
      const newToken = getAccessToken();
      const retryHeaders = new Headers(headers);
      retryHeaders.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(`/api/v1${path}`, {
        ...init,
        headers: retryHeaders,
        credentials: 'include',
      });
    } catch {
      // Refresh failed, let the 401 propagate
    }
  }

  if (!response.ok) {
    let code = 'UNKNOWN_ERROR';
    let detail = 'An unknown error occurred';
    try {
      const errorData = await response.json();
      if (errorData.code) code = errorData.code;
      if (errorData.detail) detail = errorData.detail;
    } catch {}
    throw new ApiError(response.status, code, detail);
  }

  if (response.status === 204) {
    return null as unknown as T;
  }
  
  const text = await response.text();
  if (!text) return null as unknown as T;
  return JSON.parse(text) as T;
}

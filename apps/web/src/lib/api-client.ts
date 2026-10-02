import { ErrorCode } from '@svc-rms/shared';
import { getAccessToken } from './auth/auth-utils';

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

  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
    credentials: 'include', // wait, "always sends credentials" - prompt says "always sends credentials".
  });
  
  // Actually wait, let's fix credentials: 'include'. Wait, the prompt says "always sends credentials"
  // so credentials: 'include'.
  
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

  // If status is 204 No Content, return null
  if (response.status === 204) {
    return null as any;
  }
  
  const text = await response.text();
  if (!text) return null as any;
  return JSON.parse(text) as T;
}

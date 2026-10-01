import type { ProblemJson } from '@svc-rms/shared';

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1'}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json, application/problem+json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    const maybeProblem = (await response.json().catch(() => null)) as ProblemJson | null;
    throw new Error(maybeProblem?.detail ?? `Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

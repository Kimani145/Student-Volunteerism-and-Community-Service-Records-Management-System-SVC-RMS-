import { useState, useCallback, useEffect } from 'react';
import { ApiError, apiFetch } from './api-client';

export function useApi<T>(fetchFnOrUrl: (() => Promise<T>) | string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchFn = useCallback(() => {
    if (typeof fetchFnOrUrl === 'string') {
      return apiFetch<T>(fetchFnOrUrl);
    }
    return fetchFnOrUrl();
  }, [fetchFnOrUrl]);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(500, 'UNKNOWN_ERROR', err?.message || 'An unexpected error occurred'));
      }
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, error, loading, retry: execute };
}

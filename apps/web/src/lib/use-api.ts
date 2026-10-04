import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './api-client';

export function useApi<T>(path: string, options?: RequestInit) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const fetchApi = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<T>(path, options);
      setData(res);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [path, options, retryCount]);

  useEffect(() => {
    fetchApi();
  }, [fetchApi]);

  const retry = () => setRetryCount((c) => c + 1);

  return { data, error, loading, retry, setData };
}

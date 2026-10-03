import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api-client';

describe('api-client', () => {
  it('throws readable errors for problem+json responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Auth failed' }),
      }),
    );

    await expect(apiFetch('/healthz')).rejects.toThrow('Auth failed');
  });
});

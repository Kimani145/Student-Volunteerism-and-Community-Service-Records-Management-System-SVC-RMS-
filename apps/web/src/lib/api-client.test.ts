import { describe, expect, it, vi } from 'vitest';
import { apiGet } from './api-client';

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

    await expect(apiGet('/healthz')).rejects.toThrow('Auth failed');
  });
});

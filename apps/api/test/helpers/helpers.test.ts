import { describe, it, expect } from 'vitest';
import { clearDatabase } from './db.js';
import { createUser } from './factories.js';
import { bearer } from './auth.js';
import { createTestApp } from './app.js';
import { UserRole } from '@svc-rms/shared';

describe('Test Helpers', () => {
  it('clearDatabase runs', async () => {
    await expect(clearDatabase()).resolves.toBeUndefined();
  });
  
  it('factories create data', async () => {
    const user = await createUser();
    expect(user.id).toBeDefined();
  });
  
  it('bearer mints token', async () => {
    const token = await bearer({ id: 'dummy', role: UserRole.STUDENT });
    expect(token).toMatch(/^Bearer .+/);
  });
  
  it('app boots', async () => {
    const app = await createTestApp();
    expect(app).toBeDefined();
    await app.close();
  });
});

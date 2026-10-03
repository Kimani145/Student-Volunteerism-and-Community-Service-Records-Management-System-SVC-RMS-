import { describe, it, expect } from 'vitest';
import { clearDatabase } from './db.js';
import {
  createUser,
  createStudent,
  createActivity,
  createParticipation,
  createAttendance,
  createCertificate,
  createDocument,
} from './factories.js';
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

    const student = await createStudent(user);
    expect(student.id).toBeDefined();
    expect(student.reg_number).toMatch(/^TUK\/[A-Z0-9]+\/2026$/);

    const activity = await createActivity({ status: 'PUBLISHED' });
    expect(activity.id).toBeDefined();
    expect(activity.approved_by).toBeDefined();
    expect(activity.approved_by).not.toBe(activity.organizer_id);

    const participation = await createParticipation({ student_id: student.id, activity_id: activity.id });
    expect(participation.id).toBeDefined();

    const attendance = await createAttendance({ participation_id: participation.id });
    expect(attendance.id).toBeDefined();

    const cert = await createCertificate({ participation_id: participation.id });
    expect(cert.id).toBeDefined();

    const doc = await createDocument({ activity_id: activity.id });
    expect(doc.id).toBeDefined();
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

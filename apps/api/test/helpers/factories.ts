import { ownerPrisma } from './db.js';
import { UserRole } from '@svc-rms/shared';
import * as crypto from 'node:crypto';

export async function createUser(overrides: any = {}) {
  return ownerPrisma.user.create({
    data: {
      email: `test-${crypto.randomUUID()}@example.com`,
      passwordHash: 'dummy',
      role: UserRole.STUDENT,
      ...overrides
    }
  });
}

export async function createStudent(user: any, overrides: any = {}) {
  return ownerPrisma.student.create({
    data: {
      user_id: user.id,
      reg_number: `REG-${crypto.randomUUID().slice(0, 8)}`,
      full_name: 'Test Student',
      school_id: 1,
      programme: 'BSc Computer Science',
      year_of_study: 1,
      ...overrides
    }
  });
}

export async function createActivity(overrides: any = {}) {
  return ownerPrisma.activities.create({
    data: {
      title: 'Test Activity',
      type: 'OTHER',
      status: 'DRAFT',
      capacity: 50,
      service_hours: 5,
      start_at: new Date(),
      end_at: new Date(Date.now() + 3600000),
      organizer_id: overrides.organizer_id || (await createUser({ role: UserRole.STAFF })).id,
      ...overrides
    }
  });
}

// Stubs for others that can be extended by agents
export async function createParticipation(overrides: any = {}) {
  return null; 
}
export async function createAttendance(overrides: any = {}) {
  return null;
}
export async function createCertificate(overrides: any = {}) {
  return null;
}
export async function createDocument(overrides: any = {}) {
  return null;
}

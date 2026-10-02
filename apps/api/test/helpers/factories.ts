import { ownerPrisma } from './db.js';
import { UserRole } from '@svc-rms/shared';
import * as crypto from 'node:crypto';
import * as argon2 from 'argon2';
import {
  seededSchoolId,
  seededActivityTypeIds,
  seededRecordClasses,
} from './reference-data.js';

let defaultArgon2Hash: string | null = null;
async function getDefaultPasswordHash(): Promise<string> {
  if (!defaultArgon2Hash) {
    defaultArgon2Hash = await argon2.hash('Password123!', { type: argon2.argon2id });
  }
  return defaultArgon2Hash;
}

export async function createUser(overrides: any = {}) {
  let passwordHash = overrides.passwordHash;
  if (!passwordHash) {
    if (overrides.password) {
      passwordHash = await argon2.hash(overrides.password, { type: argon2.argon2id });
    } else {
      passwordHash = await getDefaultPasswordHash();
    }
  }

  const role = overrides.role || UserRole.STUDENT;
  let canApprove = overrides.canApprove ?? false;
  if (role !== UserRole.STAFF && role !== UserRole.ADMIN) {
    canApprove = false;
  }

  const rawEmail = overrides.email || `test-${crypto.randomUUID()}@example.test`;
  const email = rawEmail.toLowerCase();

  return ownerPrisma.user.create({
    data: {
      email,
      passwordHash,
      role,
      canApprove,
      isActive: overrides.isActive ?? true,
      email_verified_at:
        overrides.email_verified_at !== undefined
          ? overrides.email_verified_at
          : overrides.emailVerifiedAt !== undefined
            ? overrides.emailVerifiedAt
            : new Date(),
      must_change_password:
        overrides.must_change_password ?? overrides.mustChangePassword ?? false,
      failed_login_count:
        overrides.failed_login_count ?? overrides.failedLoginCount ?? 0,
      locked_until: overrides.locked_until ?? overrides.lockedUntil ?? null,
    },
  });
}

export async function createStudent(user: any, overrides: any = {}) {
  const userId = user?.id || (await createUser({ role: UserRole.STUDENT })).id;
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  const regNumber = (overrides.reg_number || `TUK/${randomSuffix}/2026`).toUpperCase();

  return ownerPrisma.student.create({
    data: {
      user_id: userId,
      reg_number: regNumber,
      full_name: overrides.full_name || 'Test Student',
      gender: overrides.gender || 'UNDISCLOSED',
      school_id: overrides.school_id || seededSchoolId,
      programme: overrides.programme || 'BSc Computer Science',
      year_of_study: overrides.year_of_study || 1,
      phone: overrides.phone ?? null,
    },
  });
}

export async function createActivity(overrides: any = {}) {
  const now = Date.now();
  const start_at = overrides.start_at || new Date(now + 86400000);
  const end_at = overrides.end_at || new Date(start_at.getTime() + 3600000 * 3);
  const registration_closes_at =
    overrides.registration_closes_at || new Date(start_at.getTime() - 3600000);

  let organizer_id = overrides.organizer_id;
  if (!organizer_id) {
    const organizer = await createUser({ role: UserRole.STAFF });
    organizer_id = organizer.id;
  }

  const status = overrides.status || 'DRAFT';
  let approved_by = overrides.approved_by || null;
  let approved_at = overrides.approved_at || null;

  if (status !== 'DRAFT' && status !== 'CANCELLED') {
    if (!approved_by || approved_by === organizer_id) {
      const approver = await createUser({ role: UserRole.STAFF, canApprove: true });
      approved_by = approver.id;
    }
    if (!approved_at) {
      approved_at = new Date();
    }
  }

  return ownerPrisma.activities.create({
    data: {
      title: overrides.title || 'Community Service Activity',
      type_id: overrides.type_id || seededActivityTypeIds.OTHER || 1,
      description: overrides.description || 'Activity Description',
      venue: overrides.venue || 'Main Campus Ground',
      venue_lat: overrides.venue_lat ?? null,
      venue_lng: overrides.venue_lng ?? null,
      geofence_radius_m: overrides.geofence_radius_m ?? null,
      start_at,
      end_at,
      registration_closes_at,
      capacity: overrides.capacity || 50,
      service_hours: overrides.service_hours !== undefined ? overrides.service_hours : 5.0,
      eligible_years: overrides.eligible_years ?? [],
      status,
      partner_id: overrides.partner_id ?? null,
      organizer_id,
      approved_by,
      approved_at,
    },
  });
}

export async function createParticipation(overrides: any = {}) {
  let student_id = overrides.student_id;
  if (!student_id) {
    const studentUser = await createUser({ role: UserRole.STUDENT });
    const student = await createStudent(studentUser);
    student_id = student.id;
  }

  let activity_id = overrides.activity_id;
  if (!activity_id) {
    const activity = await createActivity({ status: 'PUBLISHED' });
    activity_id = activity.id;
  }

  const status = overrides.status || 'REGISTERED';
  const hours_awarded =
    overrides.hours_awarded !== undefined
      ? overrides.hours_awarded
      : status === 'ATTENDED'
        ? 5.0
        : 0.0;

  return ownerPrisma.participations.create({
    data: {
      student_id,
      activity_id,
      status,
      hours_awarded,
      registered_at: overrides.registered_at || new Date(),
      cancelled_at: overrides.cancelled_at || (status === 'CANCELLED' ? new Date() : null),
      hours_override_reason: overrides.hours_override_reason ?? null,
    },
  });
}

export async function createAttendance(overrides: any = {}) {
  let participation_id = overrides.participation_id;
  if (!participation_id) {
    const participation = await createParticipation({ status: 'ATTENDED' });
    participation_id = participation.id;
  }

  let recorded_by = overrides.recorded_by;
  if (!recorded_by) {
    const staff = await createUser({ role: UserRole.STAFF });
    recorded_by = staff.id;
  }

  return ownerPrisma.attendances.create({
    data: {
      participation_id,
      method: overrides.method || 'QR_SELF',
      recorded_by,
      checked_in_at: overrides.checked_in_at || new Date(),
      lat: overrides.lat ?? null,
      lng: overrides.lng ?? null,
      location_flag: overrides.location_flag ?? false,
      remarks: overrides.remarks ?? null,
    },
  });
}

export async function createCertificate(overrides: any = {}) {
  let participation_id = overrides.participation_id;
  if (!participation_id) {
    const participation = await createParticipation({
      status: 'ATTENDED',
      hours_awarded: 5.0,
    });
    participation_id = participation.id;
  }

  let issued_by = overrides.issued_by;
  if (!issued_by) {
    const staff = await createUser({ role: UserRole.STAFF, canApprove: true });
    issued_by = staff.id;
  }

  const cvid =
    overrides.cvid || `TUK-VOL-2026-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const payload =
    overrides.payload || {
      cvid,
      studentName: 'Test Student',
      activityTitle: 'Community Service Activity',
      serviceDate: '2026-10-01',
      hours: 5.0,
      issuer: 'Directorate of Community Outreach, Linkages and Partnerships, TUK',
      issuedAt: new Date().toISOString(),
      revokedAt: null,
    };

  const signature = overrides.signature || Buffer.from('dummy-signature-bytes');
  const key_id = overrides.key_id || 'key-1';
  const status = overrides.status || 'ISSUED';

  return ownerPrisma.certificates.create({
    data: {
      participation_id,
      cvid,
      payload,
      signature,
      key_id,
      status,
      issued_by,
      issued_at: overrides.issued_at || new Date(),
      revoked_at: overrides.revoked_at ?? null,
      revoked_by: overrides.revoked_by ?? null,
      revocation_reason: overrides.revocation_reason ?? null,
      supersedes_id: overrides.supersedes_id ?? null,
      template_version: overrides.template_version || 1,
      pdf_storage_key: overrides.pdf_storage_key ?? null,
      pdf_sha256: overrides.pdf_sha256 ?? null,
    },
  });
}

export async function createDocument(overrides: any = {}) {
  let activity_id = overrides.activity_id;
  if (!activity_id) {
    const activity = await createActivity({ status: 'PUBLISHED' });
    activity_id = activity.id;
  }

  let captured_by = overrides.captured_by;
  if (!captured_by) {
    const staff = await createUser({ role: UserRole.STAFF });
    captured_by = staff.id;
  }

  const sha256 =
    overrides.sha256 ||
    crypto.createHash('sha256').update(crypto.randomUUID()).digest('hex');
  const storage_key = overrides.storage_key || crypto.randomUUID();

  return ownerPrisma.documents.create({
    data: {
      activity_id,
      class_code: overrides.class_code || seededRecordClasses.ATTENDANCE_REGISTER,
      title: overrides.title || 'Attendance Register Document',
      description: overrides.description || 'Uploaded register',
      file_name: overrides.file_name || 'register.pdf',
      mime_type: overrides.mime_type || 'application/pdf',
      size_bytes:
        overrides.size_bytes !== undefined ? BigInt(overrides.size_bytes) : BigInt(1024),
      sha256,
      storage_key,
      captured_by,
      captured_at: overrides.captured_at || new Date(),
      retention_expires_at:
        overrides.retention_expires_at || new Date(Date.now() + 7 * 365 * 86400000),
      legal_hold: overrides.legal_hold ?? false,
      status: overrides.status || 'ACTIVE',
    },
  });
}

export async function createTestUser(...args: any[]) {
  let role = UserRole.STUDENT;
  let overrides: any = {};
  if (args.length >= 2 && typeof args[1] === 'string') {
    role = args[1] as UserRole;
    if (args[2] && typeof args[2] === 'object') {
      overrides = args[2];
    }
  } else if (args.length === 1 && typeof args[0] === 'string') {
    role = args[0] as UserRole;
  } else if (args.length === 1 && typeof args[0] === 'object') {
    overrides = args[0];
    role = overrides.role || role;
  }
  return createUser({ role, ...overrides });
}

export async function getAuthHeaders(...args: any[]): Promise<Record<string, string>> {
  const { bearer } = await import('./auth.js');
  let user = args[0];
  if (args.length >= 2 && typeof args[1] === 'string') {
    const email = args[1];
    user = await ownerPrisma.user.findUnique({ where: { email } });
  }
  const token = await bearer(user);
  return { Authorization: token };
}

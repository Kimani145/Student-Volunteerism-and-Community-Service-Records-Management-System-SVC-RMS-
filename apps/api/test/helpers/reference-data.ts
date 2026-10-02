import { ownerPrisma } from './db.js';

export interface SeededActivityTypes {
  TREE_PLANTING: number;
  CLEANUP: number;
  OTHER: number;
  [code: string]: number;
}

export interface SeededRecordClasses {
  ATTENDANCE_REGISTER: string;
  PHOTO: string;
}

export let seededSchoolId = 1;
export const seededActivityTypeIds: SeededActivityTypes = {
  TREE_PLANTING: 1,
  CLEANUP: 2,
  OTHER: 3,
};
export const seededRecordClasses: SeededRecordClasses = {
  ATTENDANCE_REGISTER: 'ATTENDANCE_REGISTER',
  PHOTO: 'PHOTO',
};

export async function ensureReferenceData(): Promise<{
  schoolId: number;
  activityTypeIds: SeededActivityTypes;
  recordClasses: SeededRecordClasses;
}> {
  // Idempotently insert reference data
  await ownerPrisma.$executeRaw`
    INSERT INTO schools (name)
    VALUES ('School of Science and Technology')
    ON CONFLICT (name) DO NOTHING;
  `;

  await ownerPrisma.$executeRaw`
    INSERT INTO activity_types (code, name)
    VALUES
      ('TREE_PLANTING', 'Tree Planting'),
      ('CLEANUP', 'Cleanup Campaign'),
      ('OTHER', 'Other Community Service')
    ON CONFLICT (code) DO NOTHING;
  `;

  await ownerPrisma.$executeRaw`
    INSERT INTO record_classes (code, name, retention_years)
    VALUES
      ('ATTENDANCE_REGISTER', 'Attendance Register', 7),
      ('PHOTO', 'Photographic Record', 7)
    ON CONFLICT (code) DO NOTHING;
  `;

  const school = await ownerPrisma.school.findFirst({
    orderBy: { id: 'asc' },
  });
  if (school) {
    seededSchoolId = school.id;
  }

  const types = await ownerPrisma.activityType.findMany();
  for (const t of types) {
    seededActivityTypeIds[t.code] = t.id;
  }

  return {
    schoolId: seededSchoolId,
    activityTypeIds: seededActivityTypeIds,
    recordClasses: seededRecordClasses,
  };
}

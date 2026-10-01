import { randomUUID } from 'node:crypto';
import pg from 'pg';

if (process.env.NODE_ENV === 'production') {
  throw new Error('db:seed is blocked when NODE_ENV=production');
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for db:seed');
}

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query('BEGIN');

try {
  const activityTypes = [
    ['TREE_PLANTING', 'Tree Planting'],
    ['FUNDRAISING', 'Fundraising'],
    ['CLEANUP', 'Cleanup'],
    ['DONATION', 'Donation'],
    ['MENTORSHIP', 'Mentorship'],
    ['OTHER', 'Other'],
  ];

  for (const [code, name] of activityTypes) {
    await client.query(
      'INSERT INTO activity_types (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING',
      [code, name],
    );
  }

  for (const schoolName of ['Placeholder School A', 'Placeholder School B', 'Placeholder School C']) {
    await client.query('INSERT INTO schools (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [schoolName]);
  }

  const classes = [
    ['ATTENDANCE_REGISTER', 'Attendance Register'],
    ['APPROVAL_LETTER', 'Approval Letter'],
    ['PHOTO', 'Photo'],
    ['FINANCIAL', 'Financial'],
    ['ACTIVITY_REPORT', 'Activity Report'],
  ];

  for (const [code, name] of classes) {
    await client.query(
      `INSERT INTO record_classes (code, name, retention_years)
       VALUES ($1, $2, 7)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, retention_years = EXCLUDED.retention_years`,
      [code, `${name} PLACEHOLDER`],
    );
  }

  const users = [
    { email: 'admin@example.test', role: 'ADMIN', canApprove: true },
    { email: 'staff.approver@example.test', role: 'STAFF', canApprove: true },
    { email: 'staff.member@example.test', role: 'STAFF', canApprove: false },
    { email: 'management@example.test', role: 'MANAGEMENT', canApprove: false },
  ];

  for (let i = 1; i <= 50; i += 1) {
    users.push({ email: `student${i}@example.test`, role: 'STUDENT', canApprove: false });
  }

  const school = await client.query('SELECT id FROM schools ORDER BY id LIMIT 1');
  const schoolId = school.rows[0]?.id;

  if (!schoolId) {
    throw new Error('Cannot seed students without schools');
  }

  let studentCount = 0;
  for (const user of users) {
    const userId = randomUUID();
    await client.query(
      `INSERT INTO users (id, email, password_hash, role, can_approve)
       VALUES ($1, $2, 'seed_password_hash', $3::user_role, $4)
       ON CONFLICT (email) DO NOTHING`,
      [userId, user.email, user.role, user.canApprove],
    );

    if (user.role === 'STUDENT') {
      studentCount += 1;
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [user.email]);
      const actualUserId = existing.rows[0]?.id;
      await client.query(
        `INSERT INTO students (user_id, reg_number, full_name, school_id, programme, year_of_study)
         VALUES ($1, $2, $3, $4, 'BSc Placeholder', 2)
         ON CONFLICT (user_id) DO NOTHING`,
        [actualUserId, `REG${String(studentCount).padStart(4, '0')}`, `Student ${studentCount}`, schoolId],
      );
    }
  }

  await client.query('COMMIT');
  console.log('seed complete');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}

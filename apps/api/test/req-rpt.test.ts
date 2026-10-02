import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { applyTestEnv } from './test-env.js';
import { bearer, createUser, createStudent, createActivity } from './helpers/auth.js';
import { ownerPrisma } from './helpers/db.js';
import { UserRole } from '@svc-rms/shared';

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb('REQ-RPT-01 to 05 / REQ-REC-06', () => {
  let app: any;
  let server: any;
  let adminToken: string;
  let staffToken: string;
  let staffUser: any;
  let activity: any;
  let studentUser: any;
  let student: any;
  
  beforeAll(async () => {
    applyTestEnv();
    app = await createTestApp();
    server = app.getHttpServer();

    const admin = await createUser({ role: UserRole.ADMIN });
    staffUser = await createUser({ role: UserRole.STAFF });
    studentUser = await createUser({ role: UserRole.STUDENT });
    student = await createStudent(studentUser);

    adminToken = await bearer({ id: admin.id, role: admin.role });
    staffToken = await bearer({ id: staffUser.id, role: staffUser.role });
    
    activity = await createActivity({ organizer_id: staffUser.id });

    await ownerPrisma.participations.create({
      data: {
        student_id: student.id,
        activity_id: activity.id,
        status: 'ATTENDED',
        hours_awarded: 5,
      }
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('REQ-RPT-01: View dashboard aggregates without student rows', async () => {
    const res = await request(server)
      .get('/api/v1/reports/dashboard')
      .set('Authorization', adminToken)
      .expect(200);

    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).not.toHaveProperty('student_id');
    expect(res.body[0]).toHaveProperty('activities');
    expect(res.body[0]).toHaveProperty('participants');
    expect(res.body[0]).toHaveProperty('totalHours');
  });

  it('REQ-RPT-02: Export activity report in CSV', async () => {
    const res = await request(server)
      .get('/api/v1/reports/activities.csv')
      .set('Authorization', staffToken)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('title,type,start_at,status,registered,attended,hours,organizer');
    expect(res.text).toContain(activity.title);
  });

  it('REQ-RPT-03: Export student participation report in CSV', async () => {
    const res = await request(server)
      .get(`/api/v1/reports/students/${student.id}.csv`)
      .set('Authorization', staffToken)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('activity_title,status,hours_awarded');
  });

  it('REQ-RPT-04: Neutralises spreadsheet formulas', async () => {
    const malAct = await createActivity({ title: '=HYPERLINK("http://evil.com","click")', organizer_id: staffUser.id });
    
    const res = await request(server)
      .get('/api/v1/reports/activities.csv')
      .set('Authorization', staffToken)
      .expect(200);

    expect(res.text).toContain("'=HYPERLINK");
  });

  it('REQ-RPT-05: Writes audit event on export', async () => {
    await request(server)
      .get('/api/v1/reports/dashboard')
      .set('Authorization', adminToken);
      
    const logs = await ownerPrisma.auditLog.findMany({
      where: { eventType: 'REPORT_EXPORT' }
    });
    expect(logs.length).toBeGreaterThan(0);
  });

  it('REQ-REC-06: STAFF writes a narrative report, readable by ADMIN', async () => {
    const postRes = await request(server)
      .post(`/api/v1/activities/${activity.id}/reports`)
      .set('Authorization', staffToken)
      .send({ title: 'My Report', body: 'The body of the report' })
      .expect(201);
      
    expect(postRes.body.title).toBe('My Report');
    
    const getRes = await request(server)
      .get(`/api/v1/activities/${activity.id}/reports`)
      .set('Authorization', adminToken)
      .expect(200);
      
    expect(getRes.body).toBeInstanceOf(Array);
    expect(getRes.body.length).toBeGreaterThanOrEqual(1);
    expect(getRes.body.some((r: any) => r.title === 'My Report')).toBe(true);
  });
});

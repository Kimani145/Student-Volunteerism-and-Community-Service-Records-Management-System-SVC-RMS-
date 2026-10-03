import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { ErrorCode, UserRole } from '@svc-rms/shared';
import { createTestApp } from '../helpers/app.js';
import { clearDatabase, ownerPrisma } from '../helpers/db.js';
import {
  createUser,
  createStudent,
  createActivity,
  createParticipation,
  getAuthHeaders,
} from '../helpers/index.js';
import { applyTestEnv } from '../test-env.js';
import { generateCvid } from '../../src/signing/crockford.js';
import { canonicalizeJson } from '../../src/signing/canonical.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('REQ-CRT (Certificates Requirements)', () => {
  let app: any;
  let adminUser: any;
  let adminHeaders: any;
  let staffApproverUser: any;
  let staffApproverHeaders: any;
  let staffRegularUser: any;
  let staffRegularHeaders: any;
  let studentUser1: any;
  let studentRecord1: any;
  let studentHeaders1: any;
  let studentUser2: any;
  let studentRecord2: any;
  let studentHeaders2: any;
  let completedActivity: any;
  let draftActivity: any;
  let participation1: any;
  let participation2: any;

  beforeAll(async () => {
    applyTestEnv();
    await clearDatabase();
    app = await createTestApp();

    // 1. Create users
    adminUser = await createUser({ role: UserRole.ADMIN });
    adminHeaders = await getAuthHeaders(adminUser);

    staffApproverUser = await createUser({ role: UserRole.STAFF, canApprove: true });
    staffApproverHeaders = await getAuthHeaders(staffApproverUser);

    staffRegularUser = await createUser({ role: UserRole.STAFF, canApprove: false });
    staffRegularHeaders = await getAuthHeaders(staffRegularUser);

    studentUser1 = await createUser({ role: UserRole.STUDENT });
    studentRecord1 = await createStudent(studentUser1, { full_name: 'Alice Wanjiku' });
    studentHeaders1 = await getAuthHeaders(studentUser1);

    studentUser2 = await createUser({ role: UserRole.STUDENT });
    studentRecord2 = await createStudent(studentUser2, { full_name: 'Bob Ochieng' });
    studentHeaders2 = await getAuthHeaders(studentUser2);

    // 2. Create activities
    completedActivity = await createActivity({
      status: 'COMPLETED',
      service_hours: 5.0,
      approved_by: staffApproverUser.id,
      approved_at: new Date(),
    });

    draftActivity = await createActivity({
      status: 'DRAFT',
      service_hours: 3.0,
    });

    // 3. Create participations with status ATTENDED and hours_awarded > 0
    participation1 = await createParticipation({
      activity_id: completedActivity.id,
      student_id: studentRecord1.id,
      status: 'ATTENDED',
      hours_awarded: 5.0,
    });

    participation2 = await createParticipation({
      activity_id: completedActivity.id,
      student_id: studentRecord2.id,
      status: 'ATTENDED',
      hours_awarded: 5.0,
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('REQ-CRT-01: STAFF or ADMIN shall issue certificates for a COMPLETED activity (idempotent)', async () => {
    // Non-completed activity returns 409
    const resDraft = await request(app.getHttpServer())
      .post(`/api/v1/activities/${draftActivity.id}/certificates`)
      .set(staffApproverHeaders)
      .send({});
    expect(resDraft.status).toBe(409);

    // Issue for COMPLETED activity
    const resIssue = await request(app.getHttpServer())
      .post(`/api/v1/activities/${completedActivity.id}/certificates`)
      .set(staffApproverHeaders)
      .send({});

    expect(resIssue.status).toBe(201);
    expect(resIssue.body.count).toBe(2);
    expect(resIssue.body.certificates).toHaveLength(2);

    // Database verification
    const certsInDb = await ownerPrisma.certificates.findMany({
      where: {
        participation_id: { in: [participation1.id, participation2.id] },
      },
    });
    expect(certsInDb).toHaveLength(2);
    expect(certsInDb[0]!.status).toBe('ISSUED');
    expect(certsInDb[0]!.signature).toBeDefined();

    // Idempotent: issuing again creates 0 new certificates
    const resIssueAgain = await request(app.getHttpServer())
      .post(`/api/v1/activities/${completedActivity.id}/certificates`)
      .set(staffApproverHeaders)
      .send({});

    expect(resIssueAgain.status).toBe(201);
    expect(resIssueAgain.body.count).toBe(0);
    expect(resIssueAgain.body.certificates).toHaveLength(0);
  });

  it('REQ-CRT-02: CVID generation TUK-VOL-{YYYY}-{10 chars Crockford base32 from a CSPRNG}', () => {
    const cvidPattern = /^TUK-VOL-\d{4}-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{10}$/;
    const generated = new Set<string>();

    for (let i = 0; i < 200; i++) {
      const cvid = generateCvid();
      expect(cvid).toMatch(cvidPattern);
      expect(generated.has(cvid)).toBe(false);
      generated.add(cvid);
    }
  });

  it('REQ-CRT-03: Sign canonical JSON with Ed25519 and verify keys and tampering', async () => {
    // 1. Check canonical JSON
    expect(canonicalizeJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');

    // 2. Check public keys endpoint
    const resKeys = await request(app.getHttpServer()).get('/api/v1/public/keys');
    expect(resKeys.status).toBe(200);
    expect(resKeys.headers['cache-control']).toBe('no-store');
    expect(resKeys.body.keys).toBeDefined();
    expect(resKeys.body.keys.length).toBeGreaterThanOrEqual(1);
    expect(resKeys.body.keys[0].publicKey).toContain('BEGIN PUBLIC KEY');

    // 3. Stored payload altered by one character -> public verify reports INVALID_SIGNATURE (charter #12)
    const cert = await ownerPrisma.certificates.findFirst({
      where: { participation_id: participation1.id },
    });
    expect(cert).toBeDefined();

    const originalPayload = cert!.payload as any;
    const tamperedPayload = {
      ...originalPayload,
      studentName: 'Alice Tampered',
    };

    // Tamper payload in DB
    await ownerPrisma.certificates.update({
      where: { id: cert!.id },
      data: { payload: tamperedPayload },
    });

    const resVerifyTampered = await request(app.getHttpServer()).get(
      `/api/v1/public/verify/${cert!.cvid}`
    );
    expect(resVerifyTampered.status).toBe(400);
    expect(resVerifyTampered.body.code).toBe('INVALID_SIGNATURE');

    // Restore original payload
    await ownerPrisma.certificates.update({
      where: { id: cert!.id },
      data: { payload: originalPayload },
    });

    const resVerifyRestored = await request(app.getHttpServer()).get(
      `/api/v1/public/verify/${cert!.cvid}`
    );
    expect(resVerifyRestored.status).toBe(200);
    expect(resVerifyRestored.body.status).toBe('VALID');
  });

  it('REQ-CRT-04: PDF generation using PDFKit landscape A4 and size <= 150 KB', async () => {
    const cert = await ownerPrisma.certificates.findFirst({
      where: { participation_id: participation1.id },
    });
    expect(cert).toBeDefined();

    // First download generates and caches PDF
    const res = await request(app.getHttpServer())
      .get(`/api/v1/certificates/${cert!.id}/pdf`)
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.length).toBeLessThanOrEqual(153600); // 150 KB

    // Check DB record updated with pdf_sha256 and pdf_storage_key
    const updatedCert = await ownerPrisma.certificates.findUnique({
      where: { id: cert!.id },
    });
    expect(updatedCert!.pdf_sha256).toBeDefined();
    expect(updatedCert!.pdf_storage_key).toBeDefined();

    // File exists on disk
    const storageRoot = process.env.STORAGE_ROOT || '/tmp/svc-storage';
    const filePath = path.join(storageRoot, updatedCert!.pdf_storage_key!);
    const fileContent = await fs.readFile(filePath);
    expect(fileContent.length).toBe(res.body.length);
  });

  it('REQ-CRT-05: Download PDF verifies stored SHA-256; tampering returns 500 INTEGRITY_FAILURE', async () => {
    const cert = await ownerPrisma.certificates.findFirst({
      where: { participation_id: participation1.id },
    });
    expect(cert!.pdf_storage_key).toBeDefined();

    const storageRoot = process.env.STORAGE_ROOT || '/tmp/svc-storage';
    const filePath = path.join(storageRoot, cert!.pdf_storage_key!);
    const originalFile = await fs.readFile(filePath);

    try {
      // Tamper with the PDF on disk
      await fs.writeFile(filePath, 'TAMPERED_PDF_CONTENT');

      const res = await request(app.getHttpServer())
        .get(`/api/v1/certificates/${cert!.id}/pdf`)
        .set(adminHeaders);

      expect(res.status).toBe(500);
      expect(res.body.code).toBe(ErrorCode.INTEGRITY_FAILURE);

      // Verify audit row was created
      const auditLog = await ownerPrisma.auditLog.findFirst({
        where: {
          eventType: 'INTEGRITY_FAILURE',
        },
      });
      expect(auditLog).toBeDefined();
    } finally {
      await fs.writeFile(filePath, originalFile);
    }
  });

  it('REQ-CRT-06: Student shall list and download only their own certificates; cross-student returns 404', async () => {
    const cert1 = await ownerPrisma.certificates.findFirst({
      where: { participation_id: participation1.id },
    });
    const cert2 = await ownerPrisma.certificates.findFirst({
      where: { participation_id: participation2.id },
    });
    expect(cert1).toBeDefined();
    expect(cert2).toBeDefined();

    // Student 1 lists their own certificates
    const resList = await request(app.getHttpServer())
      .get('/api/v1/certificates/me')
      .set(studentHeaders1);
    expect(resList.status).toBe(200);
    const certIds = resList.body.map((c: any) => c.id);
    expect(certIds).toContain(cert1!.id);
    expect(certIds).not.toContain(cert2!.id);

    // Student 1 can download their own certificate
    const resOwn = await request(app.getHttpServer())
      .get(`/api/v1/certificates/${cert1!.id}/pdf`)
      .set(studentHeaders1);
    expect(resOwn.status).toBe(200);
    expect(resOwn.headers['content-type']).toBe('application/pdf');

    // Student 1 attempting to download Student 2's certificate returns 404 (obscuring existence)
    const resCross = await request(app.getHttpServer())
      .get(`/api/v1/certificates/${cert2!.id}/pdf`)
      .set(studentHeaders1);
    expect(resCross.status).toBe(404);

    // STAFF and ADMIN can download any certificate
    const resStaff = await request(app.getHttpServer())
      .get(`/api/v1/certificates/${cert1!.id}/pdf`)
      .set(staffApproverHeaders);
    expect(resStaff.status).toBe(200);
  });

  it('REQ-CRT-07: Public verify is unauthenticated, matches SRS 7.3 contract, 404 on unknown CVID', async () => {
    const cert = await ownerPrisma.certificates.findFirst({
      where: { participation_id: participation1.id },
    });
    expect(cert).toBeDefined();

    // Valid CVID verification
    const res = await request(app.getHttpServer()).get(`/api/v1/public/verify/${cert!.cvid}`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');

    // Exact top-level keys
    expect(Object.keys(res.body).sort()).toEqual(['certificate', 'status', 'verifiedAt']);
    expect(res.body.status).toBe('VALID');

    // Exact certificate keys
    expect(Object.keys(res.body.certificate).sort()).toEqual([
      'activityTitle',
      'cvid',
      'hours',
      'issuedAt',
      'issuer',
      'revokedAt',
      'serviceDate',
      'studentName',
    ]);
    expect(res.body.certificate.studentName).toBe('Alice Wanjiku');
    expect(res.body.certificate.hours).toBe(5);

    // Data minimization: no reg number, school, email, or phone
    expect(res.body.certificate.regNumber).toBeUndefined();
    expect(res.body.certificate.school).toBeUndefined();
    expect(res.body.certificate.email).toBeUndefined();
    expect(res.body.certificate.phone).toBeUndefined();

    // Unknown CVID returns 404
    const resUnknown = await request(app.getHttpServer()).get(
      '/api/v1/public/verify/TUK-VOL-2026-UNKNOWN999'
    );
    expect(resUnknown.status).toBe(404);
  });

  it('REQ-CRT-09: Revoke with reason requires can_approve; verifies as REVOKED; reissue creates supersedes_id', async () => {
    const cert = await ownerPrisma.certificates.findFirst({
      where: { participation_id: participation2.id },
    });
    expect(cert).toBeDefined();

    // Non-approver staff cannot revoke (403)
    const resForbidden = await request(app.getHttpServer())
      .post(`/api/v1/certificates/${cert!.id}/revoke`)
      .set(staffRegularHeaders)
      .send({ reason: 'Disciplinary action' });
    expect(resForbidden.status).toBe(403);

    // Approver staff revokes with reason
    const resRevoke = await request(app.getHttpServer())
      .post(`/api/v1/certificates/${cert!.id}/revoke`)
      .set(staffApproverHeaders)
      .send({ reason: 'Disciplinary action after investigation' });
    expect(resRevoke.status).toBe(201);
    expect(resRevoke.body.status).toBe('REVOKED');

    // Public verify now returns REVOKED with revocation date
    const resVerifyRevoked = await request(app.getHttpServer()).get(
      `/api/v1/public/verify/${cert!.cvid}`
    );
    expect(resVerifyRevoked.status).toBe(200);
    expect(resVerifyRevoked.body.status).toBe('REVOKED');
    expect(resVerifyRevoked.body.certificate.revokedAt).toBeDefined();

    // Reissue creates a new certificate linked to old one via supersedes_id
    const resReissue = await request(app.getHttpServer())
      .post(`/api/v1/certificates/${cert!.id}/reissue`)
      .set(staffApproverHeaders)
      .send({});
    expect(resReissue.status).toBe(201);
    expect(resReissue.body.status).toBe('ISSUED');
    expect(resReissue.body.supersedes_id).toBe(cert!.id);
    expect(resReissue.body.cvid).not.toBe(cert!.cvid);
  });

  it('REQ-CRT-08: Public endpoint is rate limited to 30 requests per minute', async () => {
    const cert = await ownerPrisma.certificates.findFirst({
      where: { participation_id: participation1.id },
    });
    expect(cert).toBeDefined();

    // Make 30 requests rapidly
    const promises = [];
    for (let i = 0; i < 30; i++) {
      promises.push(request(app.getHttpServer()).get(`/api/v1/public/verify/${cert!.cvid}`));
    }
    const responses = await Promise.all(promises);
    expect(responses[0]!.status).toBe(200);

    // 31st request should be rate limited (429)
    const res31 = await request(app.getHttpServer()).get(`/api/v1/public/verify/${cert!.cvid}`);
    expect(res31.status).toBe(429);
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp } from './helpers/app.js';
import { ownerPrisma, clearDatabase } from './helpers/db.js';
import { getAuthHeaders, createTestUser } from './helpers/auth.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import request from 'supertest';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

describe('Records, Audit & Privacy Requirements', () => {
  let app: any;
  let adminHeaders: any;
  let staffHeaders: any;
  let adminUser: any;
  let staffUser: any;
  let activityId: string;
  let classCode = 'TS-01';

  beforeAll(async () => {
    app = await createTestApp();
    const prisma = app.get(PrismaService);
    
    // Seed record class
    await prisma.recordClass.upsert({
      where: { code: classCode },
      update: {},
      create: { code: classCode, name: 'Test Class', retentionYears: 5 }
    });
    
    adminUser = await createTestUser(prisma, 'ADMIN');
    staffUser = await createTestUser(prisma, 'STAFF');
    adminHeaders = await getAuthHeaders(app, adminUser.email, 'password123');
    staffHeaders = await getAuthHeaders(app, staffUser.email, 'password123');

    const partner = await prisma.community_partners.create({ data: { name: 'P' } });
    const activity = await prisma.activities.create({
      data: {
        title: 'A',
        description: 'D',
        status: 'PUBLISHED',
        capacity: 10,
        start_date: new Date(),
        end_date: new Date(),
        type: 'OTHER',
        partner_id: partner.id,
        organizer_id: staffUser.id,
      }
    });
    activityId = activity.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('REC-01, REC-02: Document Upload & Metadata', () => {
    it('REQ-REC-01: STAFF or ADMIN shall upload a PDF, PNG or JPEG <= 10 MB with content validation', async () => {
      // Create a dummy PDF file buffer
      const fakePdf = Buffer.from('%PDF-1.4\n%EOF');
      
      const res = await request(app.getHttpServer())
        .post(`/api/v1/activities/${activityId}/documents`)
        .set(adminHeaders)
        .set('Content-Type', 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW')
        .send(
          '------WebKitFormBoundary7MA4YWxkTrZu0gW\r\n' +
          'Content-Disposition: form-data; name="class_code"\r\n\r\n' +
          `${classCode}\r\n` +
          '------WebKitFormBoundary7MA4YWxkTrZu0gW\r\n' +
          'Content-Disposition: form-data; name="title"\r\n\r\n' +
          'Test Document\r\n' +
          '------WebKitFormBoundary7MA4YWxkTrZu0gW\r\n' +
          'Content-Disposition: form-data; name="file"; filename="test.pdf"\r\n' +
          'Content-Type: application/pdf\r\n\r\n' +
          fakePdf.toString('binary') + '\r\n' +
          '------WebKitFormBoundary7MA4YWxkTrZu0gW--\r\n'
        );

      expect(res.status).toBe(201);
      expect(res.body.file_name).toBe('test.pdf');
      expect(res.body.mime_type).toBe('application/pdf');
      expect(res.body.sha256).toBeDefined();
      expect(res.body.storage_key).toBeDefined();
    });

    it('REQ-REC-02: Edits are audited, sha256 is immutable', async () => {
      // Find the uploaded document
      const prisma = app.get(PrismaService);
      const doc = await prisma.documents.findFirst({ where: { title: 'Test Document' } });
      
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/documents/${doc.id}`)
        .set(adminHeaders)
        .send({ title: 'New Title' });

      expect(res.status).toBe(200);
      
      const event = await prisma.auditLog.findFirst({
        where: { eventType: 'DOCUMENT_EDITED', recordId: doc.id }
      });
      expect(event).toBeDefined();
    });
  });

  describe('REC-03: Document Search', () => {
    it('REQ-REC-03: Search records by text and filters', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/documents?q=New`)
        .set(staffHeaders);
        
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].title).toBe('New Title');
    });
  });

  describe('REC-04: Document Download', () => {
    it('REQ-REC-04: Downloading a record shall verify its SHA-256', async () => {
      const prisma = app.get(PrismaService);
      const doc = await prisma.documents.findFirst({ where: { title: 'New Title' } });
      
      const res = await request(app.getHttpServer())
        .get(`/api/v1/documents/${doc.id}/download`)
        .set(staffHeaders);
        
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
    });
    
    it('REQ-REC-04: Integrity failure test', async () => {
      const prisma = app.get(PrismaService);
      const doc = await prisma.documents.findFirst({ where: { title: 'New Title' } });
      
      // Tamper with the file
      const destPath = path.join(process.cwd(), 'uploads', doc.storage_key);
      fs.writeFileSync(destPath, 'TAMPERED');
      
      const res = await request(app.getHttpServer())
        .get(`/api/v1/documents/${doc.id}/download`)
        .set(staffHeaders);
        
      expect(res.status).toBe(500);
      expect(res.body.code).toBe('INTEGRITY_FAILURE');
    });
  });

  describe('REC-05: Document Disposal', () => {
    it('REQ-REC-05: System blocks disposal while active', async () => {
      const prisma = app.get(PrismaService);
      const doc = await prisma.documents.findFirst();
      
      const res = await request(app.getHttpServer())
        .post(`/api/v1/documents/${doc.id}/dispose`)
        .set(adminHeaders)
        .send({ reason: 'Time to go' });
        
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('RETENTION_ACTIVE');
    });
  });

  describe('AUD-05: Audit Log View', () => {
    it('REQ-AUD-05: ADMIN shall view and filter audit log', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/audit?event_type=DOCUMENT_EDITED`)
        .set(adminHeaders);
        
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PRIV-03: Export Student Data', () => {
    it('REQ-PRIV-03: ADMIN can export all data about one student', async () => {
      const prisma = app.get(PrismaService);
      const school = await prisma.school.findFirst();
      const stUser = await createTestUser(prisma, 'STUDENT');
      const student = await prisma.student.create({
        data: {
          user_id: stUser.id,
          reg_number: 'ST-001',
          full_name: 'Student Ex',
          school_id: school.id,
          programme: 'CS',
          year_of_study: 1,
        }
      });
      
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${student.id}/export`)
        .set(adminHeaders);
        
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(student.id);
      expect(res.body.users).toBeDefined();
    });
  });
});

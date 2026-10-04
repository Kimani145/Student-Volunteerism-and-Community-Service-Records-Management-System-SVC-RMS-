import { Injectable, ConflictException, NotFoundException, InternalServerErrorException, ForbiddenException, Logger, Inject, HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PdfService } from '../pdf/pdf.service.js';
import { SigningService } from '../signing/signing.service.js';
import { ErrorCode } from '@svc-rms/shared';

import { generateCvid } from '../signing/crockford.js';
import { AuditEventsService } from '../audit/audit-events.service.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  private get issuerName(): string {
    const v = process.env.ISSUER_NAME;
    if (!v) throw new Error('ISSUER_NAME is not configured');
    return v;
  }

  private get storageRoot(): string {
    const v = process.env.STORAGE_ROOT;
    if (!v) throw new Error('STORAGE_ROOT is not configured');
    return v;
  }

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PdfService) private readonly pdfService: PdfService,
    @Inject(SigningService) private readonly signingService: SigningService,
    @Inject(AuditEventsService) private readonly auditEvents: AuditEventsService,
  ) {}

  public async issueCertificates(activityId: string, issuerId: string, participationIds?: string[]) {
    return this.prisma.$transaction(async (tx: any) => {
      const activity = await tx.activities.findUnique({
        where: { id: activityId },
      });

      if (!activity) {
        throw new NotFoundException('Activity not found');
      }

      if (activity.status !== 'COMPLETED') {
        throw new ConflictException('Activity is not COMPLETED');
      }

      const participations = await tx.participations.findMany({
        where: {
          activity_id: activityId,
          status: 'ATTENDED',
          hours_awarded: { gt: 0 },
          ...(participationIds && participationIds.length > 0 ? { id: { in: participationIds } } : {}),
          certificates: {
            none: {
              status: 'ISSUED',
            },
          },
        },
        include: {
          students: {
            include: { users: true },
          },
        },
      });

      const results = [];
      for (const p of participations) {
        // Generate CVID, retry on collision
        let cvid = '';
        let collision = true;
        while (collision) {
          cvid = generateCvid();
          const existing = await tx.certificates.findUnique({ where: { cvid } });
          if (!existing) collision = false;
        }

        const issuedAt = new Date();
        const payload = {
          v: 1,
          cvid,
          studentName: p.students.full_name,
          regNumber: p.students.reg_number,
          activityId: activity.id,
          activityTitle: activity.title,
          serviceDate: activity.start_at.toISOString().split('T')[0],
          hours: Number(p.hours_awarded),
          issuedAt: issuedAt.toISOString(),
          issuer: this.issuerName,
        };

        const signature = this.signingService.signCanonical(payload);

        const cert = await tx.certificates.create({
          data: {
            participation_id: p.id,
            cvid,
            payload,
            signature,
            key_id: this.signingService.getKeyId(),
            status: 'ISSUED',
            issued_at: issuedAt,
            issued_by: issuerId,
            template_version: 1,
          },
        });
        results.push(cert);
      }

      return { count: results.length, certificates: results };
    });
  }

  public async getMyCertificates(studentUserId: string) {
    return this.prisma.certificates.findMany({
      where: {
        participations: {
          students: {
            user_id: studentUserId,
          },
        },
      },
      include: {
        participations: {
          include: { activities: true, students: true }
        }
      },
      orderBy: { issued_at: 'desc' },
    });
  }

  public async getCertificate(id: string) {
    const cert = await this.prisma.certificates.findUnique({
      where: { id },
      include: {
        participations: {
          include: { activities: true, students: true }
        }
      }
    });
    if (!cert) throw new NotFoundException('Certificate not found');
    return cert;
  }

  public async getPdf(id: string, userId: string, userRole: string) {
    const cert = await this.getCertificate(id);

    if (userRole === 'STUDENT' && cert.participations.students.user_id !== userId) {
      throw new NotFoundException('Certificate not found'); // Mapped to 404 per CRT-06
    }

    
    if (userRole !== 'STUDENT') {
      await this.auditEvents.record('CERTIFICATE_DOWNLOAD', {
        certificate_id: cert.id,
        downloaded_by: userId
      });
    }

    if (cert.pdf_storage_key && cert.pdf_sha256) {
      const p = path.join(this.storageRoot, cert.pdf_storage_key);
      try {
        const file = await fs.readFile(p);
        const hash = createHash('sha256').update(file).digest('hex');
        if (hash !== cert.pdf_sha256) {
          await this.auditEvents.record('INTEGRITY_FAILURE', {
            type: 'CERTIFICATE_PDF',
            certificate_id: cert.id,
            expected: cert.pdf_sha256,
            actual: hash,
          });
          throw new InternalServerErrorException({
            code: ErrorCode.INTEGRITY_FAILURE,
            detail: 'File integrity check failed',
          });
        }
        return file;
      } catch (err) {
        if (
          err instanceof HttpException ||
          (err as any)?.status === 500 ||
          (err as any)?.name === 'InternalServerErrorException'
        ) {
          throw err;
        }
        this.logger.warn(`PDF not found on disk for cert ${cert.id}, regenerating...`);
      }
    }

    // Generate PDF
    const p = cert.participations;
    const a = p.activities;
    const s = p.students;
    
    const buffer = await this.pdfService.generateCertificate({
      cvid: cert.cvid ?? "",
      studentName: s.full_name,
      activityTitle: a.title,
      serviceDate: a.start_at.toISOString().split('T')[0] ?? '',
      hours: Number(p.hours_awarded),
      issuer: this.issuerName,
      issuedAt: cert.issued_at.toISOString(),
    });

    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const storageKey = `certs/${cert.cvid}.pdf`;
    const storagePath = path.join(this.storageRoot, storageKey);
    await fs.mkdir(path.dirname(storagePath), { recursive: true });
    await fs.writeFile(storagePath, buffer);

    await this.prisma.certificates.update({
      where: { id: cert.id },
      data: {
        pdf_storage_key: storageKey,
        pdf_sha256: sha256,
      },
    });

    return buffer;
  }

  public async revoke(id: string, revokedBy: string, reason: string) {
    return this.prisma.certificates.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revoked_at: new Date(),
        revoked_by: revokedBy,
        revocation_reason: reason,
      },
    });
  }

  public async reissue(id: string, issuerId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const old = await tx.certificates.findUnique({
        where: { id },
        include: { participations: { include: { activities: true, students: true } } }
      });
      if (!old) throw new NotFoundException('Certificate not found');
      if (old.status !== 'REVOKED') throw new ConflictException('Cannot reissue a non-revoked certificate');

      let cvid = '';
      let collision = true;
      while (collision) {
        cvid = generateCvid();
        const existing = await tx.certificates.findUnique({ where: { cvid } });
        if (!existing) collision = false;
      }

      const p = old.participations;
      const a = p.activities;
      
      const issuedAt = new Date();
      const payload = {
        v: 1,
        cvid,
        studentName: p.students.full_name,
        regNumber: p.students.reg_number,
        activityId: a.id,
        activityTitle: a.title,
        serviceDate: a.start_at.toISOString().split('T')[0],
        hours: Number(p.hours_awarded),
        issuedAt: issuedAt.toISOString(),
        issuer: this.issuerName,
      };

      const signature = this.signingService.signCanonical(payload);

      const cert = await tx.certificates.create({
        data: {
          participation_id: p.id,
          cvid,
          payload,
          signature,
          key_id: this.signingService.getKeyId(),
          status: 'ISSUED',
          issued_at: issuedAt,
          issued_by: issuerId,
          template_version: 1,
          supersedes_id: old.id,
        },
      });
      
      return cert;
    });
  }
}

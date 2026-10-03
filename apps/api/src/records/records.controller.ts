import { Controller, Post, Get, Patch, Put, Param, Query, Body, Req, Res, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { RecordsService } from './records.service.js';
import { StorageService } from '../storage/storage.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { documentPatchSchema, documentSearchSchema, documentDisposeSchema, documentLegalHoldSchema } from '@svc-rms/shared';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole, ErrorCode } from '@svc-rms/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AuditEventsService } from '../audit/audit-events.service.js';
import { fileTypeFromBuffer } from 'file-type';
import { parseMultipart } from './multipart-parser.js';
import * as crypto from 'crypto';

@Controller()
export class RecordsController {
  constructor(
    private recordsService: RecordsService,
    private storageService: StorageService,
    private prisma: PrismaService,
    private auditEvents: AuditEventsService
  ) {}

  @Get('documents')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async searchDocuments(@Query(new ZodValidationPipe(documentSearchSchema)) query: any) {
    return this.recordsService.search(query);
  }

  @Get('documents/:id')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async getDocument(@Param('id') id: string) {
    return this.recordsService.getDocument(id);
  }

  @Patch('documents/:id')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async patchDocument(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(documentPatchSchema)) body: any
  ) {
    const doc = await this.recordsService.patchDocument(id, body);
    await this.auditEvents.record('DOCUMENT_EDITED', { id, edits: body });
    return doc;
  }

  @Put('documents/:id/legal-hold')
  @Roles(UserRole.ADMIN)
  async setLegalHold(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(documentLegalHoldSchema)) body: any
  ) {
    const doc = await this.recordsService.setLegalHold(id, body.legal_hold);
    await this.auditEvents.record('LEGAL_HOLD_UPDATED', { id, legal_hold: body.legal_hold });
    return doc;
  }

  @Post('documents/:id/dispose')
  @Roles(UserRole.ADMIN)
  async disposeDocument(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(documentDisposeSchema)) body: any,
    @CurrentUser() user: any
  ) {
    try {
      const doc = await this.recordsService.disposeDocument(id, body.reason, user.id);
      await this.auditEvents.record('DOCUMENT_DISPOSED', { id, reason: body.reason });
      return doc;
    } catch (error: any) {
      if (error instanceof ConflictException && error.message === 'RETENTION_ACTIVE') {
        await this.auditEvents.record('DISPOSAL_BLOCKED_RETENTION', { id, reason: body.reason });
        throw new ConflictException({ code: ErrorCode.RETENTION_ACTIVE, detail: 'Retention still active or on legal hold' });
      }
      throw error;
    }
  }

  @Get('documents/:id/download')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async downloadDocument(@Param('id') id: string, @Res() res: FastifyReply) {
    const doc = await this.recordsService.getDocument(id);
    if (doc.status === 'DISPOSED') {
      throw new ConflictException('Document is disposed');
    }
    const buffer = await this.storageService.getFile(doc.storage_key);
    
    // verify sha256
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    if (hash !== doc.sha256) {
      await this.auditEvents.record('INTEGRITY_FAILURE', { id, expected: doc.sha256, actual: hash });
      throw new InternalServerErrorException({ code: ErrorCode.INTEGRITY_FAILURE, detail: 'File integrity check failed' });
    }

    res.header('Content-Disposition', `attachment; filename="${doc.file_name}"`);
    res.type(doc.mime_type);
    res.send(buffer);
  }

  @Post('activities/:id/documents')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async uploadDocument(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @CurrentUser() user: any
  ) {
    const { fields, fileBuffer, fileName, mimeType } = await parseMultipart(req);
    
    if (!fileBuffer) {
      throw new ConflictException('No file uploaded');
    }
    
    if (fileBuffer.length > 10 * 1024 * 1024) {
      throw new ConflictException({ code: ErrorCode.PAYLOAD_TOO_LARGE, detail: 'File too large' });
    }

    // magic byte validation
    const type = await fileTypeFromBuffer(fileBuffer);
    if (!type || !['pdf', 'png', 'jpg'].includes(type.ext)) {
      throw new ConflictException({ code: ErrorCode.UNSUPPORTED_MEDIA, detail: 'Unsupported file type' });
    }

    // store file
    const storeResult = await this.storageService.storeFile({ buffer: fileBuffer, size: fileBuffer.length });

    // Get record class retention
    const recordClass = await this.prisma.recordClass.findUnique({ where: { code: fields.class_code } });
    if (!recordClass) throw new ConflictException('Invalid class_code');
    
    const retentionDate = new Date();
    retentionDate.setFullYear(retentionDate.getFullYear() + recordClass.retentionYears);

    // insert document
    const doc = await this.prisma.documents.create({
      data: {
        activity_id: id,
        class_code: fields.class_code,
        title: fields.title || fileName,
        description: fields.description,
        file_name: fileName,
        mime_type: type.mime,
        size_bytes: storeResult.size,
        sha256: storeResult.sha256,
        storage_key: storeResult.key,
        captured_by: user.id,
        retention_expires_at: retentionDate,
      }
    });

    await this.auditEvents.record('DOCUMENT_UPLOADED', { document_id: doc.id });
    return doc;
  }
}

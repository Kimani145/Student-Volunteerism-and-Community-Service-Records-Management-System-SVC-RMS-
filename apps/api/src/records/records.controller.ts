import {
  Controller,
  Post,
  Get,
  Patch,
  Put,
  Param,
  Query,
  Body,
  Req,
  Res,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
  UnprocessableEntityException,
  Inject,
} from '@nestjs/common';
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
import * as crypto from 'crypto';
import * as path from 'path';

@Controller()
export class RecordsController {
  constructor(
    @Inject(RecordsService) private readonly recordsService: RecordsService,
    @Inject(StorageService) private readonly storageService: StorageService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditEventsService) private readonly auditEvents: AuditEventsService,
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

    res.header('Content-Disposition', `attachment; filename="${path.basename(doc.file_name)}"`);
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
    if (!req.isMultipart()) {
      throw new BadRequestException('Request must be multipart/form-data');
    }

    const maxUploadBytes = parseInt(process.env.MAX_UPLOAD_BYTES || '10485760', 10);
    const parts = req.parts();
    const fields: Record<string, string> = {};
    let fileData: { key: string; size: number; sha256: string; mimeType: string; ext: string; fileName: string } | null = null;

    for await (const part of parts) {
      if (part.type === 'file') {
        if (fileData) {
          part.file.resume();
          continue;
        }
        const stored = await this.storageService.storeStream(part.file, maxUploadBytes);
        fileData = {
          ...stored,
          fileName: part.filename,
        };
      } else {
        fields[part.fieldname] = part.value as string;
      }
    }

    if (!fileData) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, detail: 'No file uploaded' });
    }

    const classCode = fields.class_code;
    if (!classCode) {
      await this.storageService.removeFile(fileData.key);
      throw new UnprocessableEntityException({ code: ErrorCode.VALIDATION_ERROR, detail: 'class_code is required' });
    }

    const recordClass = await this.prisma.recordClass.findUnique({ where: { code: classCode } });
    if (!recordClass) {
      await this.storageService.removeFile(fileData.key);
      throw new UnprocessableEntityException({ code: ErrorCode.VALIDATION_ERROR, detail: 'Invalid class_code' });
    }

    const retentionDate = new Date();
    retentionDate.setFullYear(retentionDate.getFullYear() + recordClass.retentionYears);

    const doc = await this.prisma.documents.create({
      data: {
        activity_id: id,
        class_code: classCode,
        title: fields.title || fileData.fileName,
        description: fields.description || null,
        file_name: fileData.fileName,
        mime_type: fileData.mimeType,
        size_bytes: fileData.size,
        sha256: fileData.sha256,
        storage_key: fileData.key,
        captured_by: user.id,
        retention_expires_at: retentionDate,
      },
    });

    await this.auditEvents.record('DOCUMENT_UPLOADED', { document_id: doc.id });
    return {
      ...doc,
      size_bytes: Number(doc.size_bytes),
    };
  }
}

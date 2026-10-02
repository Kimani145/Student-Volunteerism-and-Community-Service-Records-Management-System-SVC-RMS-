import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { documentPatchSchema, documentDisposeSchema, documentLegalHoldSchema } from '@svc-rms/shared';

@Injectable()
export class RecordsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService
  ) {}

  async search(query: any) {
    const { q, activity_id, class_code, mime_type, from, to, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (activity_id) where.activity_id = activity_id;
    if (class_code) where.class_code = class_code;
    if (mime_type) where.mime_type = mime_type;
    if (from || to) {
      where.captured_at = {};
      if (from) where.captured_at.gte = new Date(from);
      if (to) where.captured_at.lte = new Date(to);
    }
    if (q) {
      // Using Raw query for full text search as requested: websearch_to_tsquery
      // Prisma doesn't natively support websearch_to_tsquery inside `where` for search_tsv well in older versions without preview features,
      // but we can use raw query for the whole or just use the generated column if Prisma supports it.
      // Wait, let's just use Prisma's `contains` if full text is complex, or execute raw query for ids.
      const rawIds = await this.prisma.$queryRaw<{id: string}[]>`
        SELECT id FROM documents 
        WHERE search_tsv @@ websearch_to_tsquery('simple', ${q})
      `;
      where.id = { in: rawIds.map((r: any) => r.id) };
    }

    const [total, data] = await Promise.all([
      this.prisma.documents.count({ where }),
      this.prisma.documents.findMany({
        where,
        skip,
        take: limit,
        orderBy: { captured_at: 'desc' }
      })
    ]);

    return { data, total, page, limit };
  }

  async getDocument(id: string) {
    const doc = await this.prisma.documents.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async patchDocument(id: string, updateData: any) {
    await this.getDocument(id);
    return this.prisma.documents.update({
      where: { id },
      data: updateData,
    });
  }

  async setLegalHold(id: string, legal_hold: boolean) {
    await this.getDocument(id);
    return this.prisma.documents.update({
      where: { id },
      data: { legal_hold }
    });
  }

  async disposeDocument(id: string, reason: string, adminId: string) {
    const doc = await this.getDocument(id);
    if (new Date() < doc.retention_expires_at || doc.legal_hold) {
      throw new ConflictException('RETENTION_ACTIVE');
    }

    // Remove file
    await this.storage.removeFile(doc.storage_key);

    return this.prisma.documents.update({
      where: { id },
      data: {
        status: 'DISPOSED',
        disposed_at: new Date(),
        disposed_by: adminId,
        disposal_reason: reason
      }
    });
  }
}

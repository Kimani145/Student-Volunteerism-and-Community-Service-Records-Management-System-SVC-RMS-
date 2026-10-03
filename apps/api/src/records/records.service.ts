import { Injectable, NotFoundException, ConflictException, ForbiddenException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { documentPatchSchema, documentDisposeSchema, documentLegalHoldSchema } from '@svc-rms/shared';

function serializeDoc<T extends { size_bytes?: bigint | number } | null>(doc: T): T {
  if (!doc) return doc;
  return {
    ...doc,
    size_bytes: Number(doc.size_bytes),
  };
}

@Injectable()
export class RecordsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService
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

    return { data: data.map(serializeDoc), total, page, limit };
  }

  async getDocument(id: string) {
    const doc = await this.prisma.documents.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    return serializeDoc(doc);
  }

  async patchDocument(id: string, updateData: any) {
    await this.getDocument(id);
    const updated = await this.prisma.documents.update({
      where: { id },
      data: updateData,
    });
    return serializeDoc(updated);
  }

  async setLegalHold(id: string, legal_hold: boolean) {
    await this.getDocument(id);
    const updated = await this.prisma.documents.update({
      where: { id },
      data: { legal_hold }
    });
    return serializeDoc(updated);
  }

  async disposeDocument(id: string, reason: string, adminId: string) {
    const doc = await this.getDocument(id);
    if (new Date() < doc.retention_expires_at || doc.legal_hold) {
      throw new ConflictException('RETENTION_ACTIVE');
    }

    // Remove file
    await this.storage.removeFile(doc.storage_key);

    const updated = await this.prisma.documents.update({
      where: { id },
      data: {
        status: 'DISPOSED',
        disposed_at: new Date(),
        disposed_by: adminId,
        disposal_reason: reason
      }
    });
    return serializeDoc(updated);
  }
}

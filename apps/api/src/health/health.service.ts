import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async isReady(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.prisma.$queryRaw`
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'audit_log'
      `;
      return true;
    } catch {
      return false;
    }
  }
}

import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL_MIGRATE || process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5433/svc_test';
export const ownerPrisma = new PrismaClient({
  datasources: {
    db: { url }
  }
});

const PRESERVED_TABLES = new Set([
  'audit_log',
  'schools',
  'activity_types',
  'record_classes',
  '_prisma_migrations',
  '_raw_migrations',
]);

export async function clearDatabase(): Promise<void> {
  const tables = await ownerPrisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations';
  `;
  for (const { tablename } of tables) {
    if (!PRESERVED_TABLES.has(tablename)) {
      await ownerPrisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
    }
  }
}

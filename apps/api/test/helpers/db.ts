import { PrismaClient } from '@prisma/client';

export const ownerPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_MIGRATE || process.env.DATABASE_URL,
    }
  }
});

export async function clearDatabase(): Promise<void> {
  const tables = await ownerPrisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations';
  `;
  for (const { tablename } of tables) {
    if (tablename !== 'audit_log') { // Can't truncate audit_log easily if triggers are on, but owner can truncate
      await ownerPrisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
    }
  }
}

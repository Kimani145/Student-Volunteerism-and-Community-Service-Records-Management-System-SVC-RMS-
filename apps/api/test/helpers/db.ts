import { PrismaClient } from '@prisma/client';
import { resolveTestOwnerUrl } from '../test-env.js';

// Resolved at import time (global setup imports this before applyTestEnv runs), so it must not depend on it.
const url = resolveTestOwnerUrl();
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
  const name = (() => {
    try {
      return decodeURIComponent(new URL(url).pathname.slice(1));
    } catch {
      return '';
    }
  })();
  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to truncate database "${name}": test databases must end with _test (dev data lives in svc_dev).`);
  }
  const tables = await ownerPrisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations';
  `;
  for (const { tablename } of tables) {
    if (!PRESERVED_TABLES.has(tablename)) {
      await ownerPrisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
    }
  }
}

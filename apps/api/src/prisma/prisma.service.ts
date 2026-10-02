import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { AuditContext, AuditContextStorage } from './audit-context.storage.js';

const WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

function getModelDelegate(client: Record<string, unknown>, model: string): Record<string, unknown> | undefined {
  const camel = model.charAt(0).toLowerCase() + model.slice(1);
  if (client[camel] && typeof client[camel] === 'object') {
    return client[camel] as Record<string, unknown>;
  }
  if (client[model] && typeof client[model] === 'object') {
    return client[model] as Record<string, unknown>;
  }
  const lower = model.toLowerCase();
  if (client[lower] && typeof client[lower] === 'object') {
    return client[lower] as Record<string, unknown>;
  }
  return undefined;
}

async function setAuditConfig(tx: Prisma.TransactionClient, ctx: AuditContext | undefined): Promise<void> {
  if (ctx) {
    await tx.$executeRaw`SELECT
      set_config('app.user_id', ${ctx.userId ?? ''}, true),
      set_config('app.client_ip', ${ctx.clientIp ?? ''}, true),
      set_config('app.request_id', ${ctx.requestId ?? ''}, true)`;
  }
}

function checkAuditContext(storage: AuditContextStorage): AuditContext | undefined {
  const ctx = storage.get();
  if (!ctx) {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Audit context required for write operations');
    }
  }
  return ctx;
}

function isRawWrite(args: unknown): boolean {
  let sql = '';
  if (typeof args === 'string') {
    sql = args;
  } else if (Array.isArray(args) && typeof args[0] === 'string') {
    sql = args[0];
  } else if (args && typeof args === 'object' && 'strings' in args && Array.isArray((args as { strings: string[] }).strings)) {
    sql = (args as { strings: string[] }).strings.join(' ');
  } else if (args && typeof args === 'object' && 'text' in args && typeof (args as { text: string }).text === 'string') {
    sql = (args as { text: string }).text;
  }
  return /^\s*(insert|update|delete|truncate|drop|alter)\b/i.test(sql.trim());
}

function createAuditExtension(client: PrismaClient, storage: AuditContextStorage) {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }): Promise<unknown> {
          if (!WRITE_OPERATIONS.has(operation)) {
            return query(args);
          }

          checkAuditContext(storage);

          if (storage.isInTransaction()) {
            return query(args);
          }

          return client.$transaction(async (tx) => {
            const txDelegate = getModelDelegate(tx as unknown as Record<string, unknown>, model);
            if (txDelegate && typeof txDelegate[operation] === 'function') {
              return (txDelegate[operation] as (a: unknown) => Promise<unknown>)(args);
            }
            return query(args);
          });
        },
      },
      async $executeRaw({
        args,
        query,
      }: {
        args: unknown;
        query: (args: unknown) => Promise<unknown>;
      }): Promise<unknown> {
        checkAuditContext(storage);
        if (storage.isInTransaction()) {
          return query(args);
        }
        return client.$transaction(async (tx) => {
          const rawExecutor = tx as unknown as { $executeRaw: (a: unknown) => Promise<unknown> };
          return rawExecutor.$executeRaw(args);
        });
      },
      async $executeRawUnsafe({
        args,
        query,
      }: {
        args: unknown;
        query: (args: unknown) => Promise<unknown>;
      }): Promise<unknown> {
        checkAuditContext(storage);
        if (storage.isInTransaction()) {
          return query(args);
        }
        return client.$transaction(async (tx) => {
          const rawUnsafeExecutor = tx as unknown as {
            $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown>;
          };
          if (Array.isArray(args)) {
            return rawUnsafeExecutor.$executeRawUnsafe(args[0] as string, ...args.slice(1));
          }
          return rawUnsafeExecutor.$executeRawUnsafe(args as string);
        });
      },
      async $queryRaw({
        args,
        query,
      }: {
        args: unknown;
        query: (args: unknown) => Promise<unknown>;
      }): Promise<unknown> {
        if (isRawWrite(args)) {
          checkAuditContext(storage);
          if (storage.isInTransaction()) {
            return query(args);
          }
          return client.$transaction(async (tx) => {
            const rawExecutor = tx as unknown as { $queryRaw: (a: unknown) => Promise<unknown> };
            return rawExecutor.$queryRaw(args);
          });
        }
        return query(args);
      },
      async $queryRawUnsafe({
        args,
        query,
      }: {
        args: unknown;
        query: (args: unknown) => Promise<unknown>;
      }): Promise<unknown> {
        if (isRawWrite(args)) {
          checkAuditContext(storage);
          if (storage.isInTransaction()) {
            return query(args);
          }
          return client.$transaction(async (tx) => {
            const rawUnsafeExecutor = tx as unknown as {
              $queryRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown>;
            };
            if (Array.isArray(args)) {
              return rawUnsafeExecutor.$queryRawUnsafe(args[0] as string, ...args.slice(1));
            }
            return rawUnsafeExecutor.$queryRawUnsafe(args as string);
          });
        }
        return query(args);
      },
    },
  });
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly extended: Record<string, unknown>;

  constructor(@Inject(AuditContextStorage) private readonly auditContextStorage: AuditContextStorage) {
    super();
    this.extended = createAuditExtension(this, auditContextStorage) as unknown as Record<string, unknown>;
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop in target.extended) {
          const val = target.extended[prop as string];
          if (typeof val === 'function') {
            return (val as (...args: unknown[]) => unknown).bind(target.extended);
          }
          return val;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  override async $transaction<T>(...args: unknown[]): Promise<T> {
    if (typeof args[0] === 'function') {
      const fn = args[0] as (tx: Prisma.TransactionClient) => Promise<T>;
      const ctx = checkAuditContext(this.auditContextStorage);
      return super.$transaction(async (tx) => {
        if (this.auditContextStorage.isInTransaction()) {
          return fn(tx);
        }
        return this.auditContextStorage.runInTransaction(async () => {
          await setAuditConfig(tx, ctx);
          return fn(tx);
        });
      }, args[1] as Parameters<PrismaClient['$transaction']>[1]) as Promise<T>;
    }
    return (super.$transaction as (...params: unknown[]) => Promise<T>)(...args);
  }

  async withAuditContext<T>(
    ctx: AuditContext,
    callback: (client: PrismaService) => Promise<T>,
  ): Promise<T> {
    return this.auditContextStorage.run(ctx, () => callback(this));
  }

  async runAsSystem<T>(
    label: string,
    fn: (client: PrismaService) => Promise<T>,
  ): Promise<T> {
    const requestId = `system:${label}:${Date.now()}`;
    const ctx: AuditContext = {
      userId: '',
      clientIp: '127.0.0.1',
      requestId,
    };
    return this.auditContextStorage.run(ctx, async () => {
      await (this as unknown as PrismaClient).auditLog.create({
        data: {
          source: 'APP',
          eventType: `system.${label}`,
          requestId,
        },
      });
      return fn(this);
    });
  }
}

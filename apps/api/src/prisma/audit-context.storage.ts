import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export type AuditContext = {
  userId?: string | null;
  clientIp?: string | null;
  requestId?: string | null;
};

const globalAls = new AsyncLocalStorage<AuditContext>();
const globalTxAls = new AsyncLocalStorage<boolean>();

@Injectable()
export class AuditContextStorage {
  private readonly als = globalAls;
  private readonly txAls = globalTxAls;

  run<T>(ctx: AuditContext, callback: () => T): T {
    return this.als.run(ctx, callback);
  }

  enterWith(ctx: AuditContext): void { this.als.enterWith(ctx); }

  get(): AuditContext | undefined {
    return this.als.getStore();
  }

  runInTransaction<T>(callback: () => T): T {
    return this.txAls.run(true, callback);
  }

  isInTransaction(): boolean {
    return Boolean(this.txAls.getStore());
  }
}

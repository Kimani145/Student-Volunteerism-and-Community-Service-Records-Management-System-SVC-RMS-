import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export type AuditContext = {
  userId?: string | null;
  clientIp?: string | null;
  requestId?: string | null;
};

@Injectable()
export class AuditContextStorage {
  private readonly als = new AsyncLocalStorage<AuditContext>();
  private readonly txAls = new AsyncLocalStorage<boolean>();

  run<T>(ctx: AuditContext, callback: () => Promise<T>): Promise<T> {
    return this.als.run(ctx, callback);
  }

  enterWith(ctx: AuditContext): void { this.als.enterWith(ctx); }

  get(): AuditContext | undefined {
    return this.als.getStore();
  }

  runInTransaction<T>(callback: () => Promise<T>): Promise<T> {
    return this.txAls.run(true, callback);
  }

  isInTransaction(): boolean {
    return Boolean(this.txAls.getStore());
  }
}

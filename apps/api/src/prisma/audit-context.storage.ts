import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export type AuditContext = {
  userId: string;
  clientIp: string;
  requestId: string;
};

@Injectable()
export class AuditContextStorage {
  private readonly als = new AsyncLocalStorage<AuditContext>();

  run<T>(ctx: AuditContext, callback: () => Promise<T>): Promise<T> {
    return this.als.run(ctx, callback);
  }

  get(): AuditContext | undefined {
    return this.als.getStore();
  }
}

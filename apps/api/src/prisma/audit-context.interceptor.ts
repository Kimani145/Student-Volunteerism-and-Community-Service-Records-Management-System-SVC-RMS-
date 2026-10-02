import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import * as crypto from 'node:crypto';
import { AuditContextStorage } from './audit-context.storage.js';

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(private readonly auditContextStorage: AuditContextStorage) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    if (!request) {
      return next.handle();
    }

    let requestId = request.headers?.['x-request-id'] as string;
    if (!requestId) {
      requestId = crypto.randomUUID();
      if (request.headers) {
        request.headers['x-request-id'] = requestId;
      }
    }
    const clientIp = request.ip || request.socket?.remoteAddress || '';
    const userId = request.user?.id || '';

    return new Observable((subscriber) => {
      return this.auditContextStorage.run({ userId, clientIp, requestId }, () => {
        const sub = next.handle().subscribe(subscriber);
        return () => sub.unsubscribe();
      });
    });
  }
}

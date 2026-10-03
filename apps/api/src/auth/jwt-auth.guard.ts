import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { jwtVerify } from 'jose';
import { PUBLIC_KEY } from './public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditContextStorage } from '../prisma/audit-context.storage.js';
import { ErrorCode } from '@svc-rms/shared';
import * as crypto from 'node:crypto';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private secret: Uint8Array;

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditContextStorage) private readonly auditContextStorage: AuditContextStorage,
  ) {
    const secretKey = process.env.JWT_ACCESS_SECRET;
    if (!secretKey) {
      throw new Error('JWT_ACCESS_SECRET is required');
    }
    this.secret = new TextEncoder().encode(secretKey);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    let requestId = request.headers['x-request-id'] as string;
    if (!requestId) {
      requestId = crypto.randomUUID();
      request.headers['x-request-id'] = requestId;
    }
    const clientIp = request.ip || request.socket?.remoteAddress || '';

    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    let userId = '';

    const authHeader = request.headers.authorization;
    if (!isPublic) {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException({ code: ErrorCode.UNAUTHENTICATED, detail: 'Missing or invalid token' });
      }
      const token = authHeader.split(' ')[1];

      let payload;
      try {
        const { payload: verified } = await jwtVerify(token, this.secret, {
          algorithms: ['HS256'],
        });
        payload = verified;
      } catch {
        throw new UnauthorizedException({ code: ErrorCode.UNAUTHENTICATED, detail: 'Token invalid' });
      }

      const payloadSub = payload.sub;
      if (!payloadSub) {
        throw new UnauthorizedException({ code: ErrorCode.UNAUTHENTICATED, detail: 'Token missing sub claim' });
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payloadSub },
        include: { student: true }
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException({ code: ErrorCode.UNAUTHENTICATED, detail: 'User not found or inactive' });
      }

      request.user = {
        id: user.id,
        role: user.role,
        canApprove: user.canApprove,
        studentId: user.student?.id,
      };
      
      userId = user.id;
    }

    this.auditContextStorage.enterWith({ userId, clientIp, requestId });
    return true;
  }
}

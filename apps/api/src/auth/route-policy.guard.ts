import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, UserRole } from '@svc-rms/shared';
import { PUBLIC_KEY } from './public.decorator.js';
import { ROLES_KEY } from './roles.decorator.js';

type RequestLike = {
  user?: { role?: UserRole };
  headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class RoutePolicyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isPublic && (!roles || roles.length === 0)) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        detail: 'Route policy metadata missing',
      });
    }

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestLike>();
    const headerRole = request.headers['x-role'];
    const role =
      request.user?.role ?? (typeof headerRole === 'string' ? (headerRole as UserRole) : undefined);

    if (!role) {
      throw new UnauthorizedException({ code: ErrorCode.UNAUTHORIZED, detail: 'Authentication required' });
    }

    if (!roles?.includes(role)) {
      throw new ForbiddenException({ code: ErrorCode.FORBIDDEN, detail: 'Insufficient role' });
    }

    return true;
  }
}

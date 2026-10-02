import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
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
};

@Injectable()
export class RoutePolicyGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector = new Reflector()) {}

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
    if (!request.user) {
      throw new UnauthorizedException({ code: ErrorCode.UNAUTHENTICATED, detail: 'Authentication required' });
    }

    const role = request.user.role;
    if (!role || !roles.includes(role)) {
      throw new ForbiddenException({ code: ErrorCode.FORBIDDEN, detail: 'Insufficient role' });
    }

    return true;
  }
}

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@svc-rms/shared';

export type CurrentUserType = {
  id: string;
  role: UserRole;
  canApprove: boolean;
  studentId?: string;
};

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserType => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

import { NotFoundException } from '@nestjs/common';
import { ErrorCode } from '@svc-rms/shared';

export function assertOwns(condition: boolean): void {
  if (!condition) {
    throw new NotFoundException({
      code: ErrorCode.NOT_FOUND,
      detail: 'Resource not found', // Return 404 instead of 403 to prevent IDOR leaks
    });
  }
}
